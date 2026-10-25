"""
services/ai_extraction_service.py
AI extraction abstraction layer.

Raw OCR text -> AIExtractionService.extract_fields() -> structured JSON
with a confidence score per field (see schemas/field.py).

The application is not hard-coded around one AI provider: add a new
BaseAIProvider subclass and register it in AIExtractionService._build_provider
to switch providers without touching routes/ or the rest of the pipeline.
"""

import json
from abc import ABC, abstractmethod
from typing import Any

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class BaseAIProvider(ABC):
    @abstractmethod
    def extract(self, ocr_text: str, document_type: str, field_schema: list[dict]) -> dict[str, Any]:
        """Returns {"fields": {field_name: {"value": ..., "confidence": 0.0-1.0}}}"""
        raise NotImplementedError


class AnthropicAIProvider(BaseAIProvider):
    """Uses the Anthropic API with a structured-JSON prompt to extract
    fields defined by the document's template. Requires AI_API_KEY."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def extract(self, ocr_text: str, document_type: str, field_schema: list[dict]) -> dict[str, Any]:
        import httpx

        field_names = [f["name"] for f in field_schema]
        prompt = (
            f"Extract the following fields from this {document_type} document text. "
            f"Fields: {', '.join(field_names)}. "
            "Return ONLY minified JSON of the form "
            '{"fields": {"<field_name>": {"value": "<string>", "confidence": <0-1 float>}}}. '
            "If a field is not present, omit it.\n\n"
            f"Document text:\n{ocr_text}"
        )
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": self.model,
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["content"][0]["text"]
        return json.loads(content)


class MockAIProvider(BaseAIProvider):
    """Generates plausible field values with varied confidence scores so
    the review workflow (including low-confidence flags) can be
    demonstrated without a live AI provider key."""

    def extract(self, ocr_text: str, document_type: str, field_schema: list[dict]) -> dict[str, Any]:
        import random

        fields = {}
        for f in field_schema:
            confidence = round(random.uniform(0.55, 0.99), 2)
            fields[f["name"]] = {
                "value": self._sample_value(f["name"], f.get("type", "text")),
                "confidence": confidence,
            }
        logger.info("MockAIProvider: extracted %d fields for document_type=%s", len(fields), document_type)
        return {"fields": fields}

    @staticmethod
    def _sample_value(name: str, field_type: str) -> str:
        import random
        from datetime import date, timedelta

        if field_type == "date":
            return str(date.today() - timedelta(days=random.randint(0, 10)))
        if field_type == "currency":
            return f"{random.uniform(10, 2000):.2f}"
        if field_type == "number":
            return str(random.randint(1, 25))
        if field_type == "email":
            return "demo.contact@example.com"
        return f"Demo {name.replace('_', ' ').title()}"


class AIExtractionService:
    """Facade used by routes/services elsewhere in the app. Selects a
    provider from configuration and normalizes every provider's output
    into the same {"fields": {...}} shape."""

    def __init__(self):
        settings = get_settings()
        self.provider = self._build_provider(settings.ai_provider, settings.ai_api_key, settings.ai_model, settings.demo_mode)

    @staticmethod
    def _build_provider(provider_name: str, api_key: str, model: str, demo_mode: bool) -> BaseAIProvider:
        if demo_mode or provider_name == "mock" or not api_key:
            return MockAIProvider()
        if provider_name == "anthropic":
            return AnthropicAIProvider(api_key, model)
        logger.warning("Unknown AI_PROVIDER '%s' — falling back to mock.", provider_name)
        return MockAIProvider()

    def extract_fields(self, ocr_text: str, document_type: str, field_schema: list[dict]) -> list[dict]:
        """Returns a list shaped like schemas.field.ExtractedField, ready
        to persist to the extracted_fields table."""
        try:
            raw = self.provider.extract(ocr_text, document_type, field_schema)
        except Exception:
            logger.exception("AI extraction failed — returning empty field set")
            return []

        results = []
        schema_by_name = {f["name"]: f for f in field_schema}
        for name, data in raw.get("fields", {}).items():
            confidence = float(data.get("confidence", 0.0))
            required = schema_by_name.get(name, {}).get("required", False)
            results.append({
                "field_name": name,
                "field_value": str(data.get("value", "")),
                "confidence_score": confidence,
                "requires_review": confidence < 0.85 or (required and not data.get("value")),
            })
        return results
