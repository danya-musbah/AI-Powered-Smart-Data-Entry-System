"""
services/ocr_service.py
OCR abstraction layer.

Document -> OCRService.extract_text() -> raw text

Swap providers by changing OCR_PROVIDER in .env — nothing outside this
file needs to change. A "mock" provider is always available so the app
can be demonstrated without any OCR credentials configured (see
DEMO_MODE / README "Demo Mode" section).
"""

from abc import ABC, abstractmethod

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class BaseOCRProvider(ABC):
    @abstractmethod
    def extract_text(self, file_bytes: bytes, file_type: str) -> str:
        """Returns raw extracted text from a document's bytes."""
        raise NotImplementedError


class TesseractOCRProvider(BaseOCRProvider):
    """Local OCR using pytesseract. Works offline, no API key required.
    Requires the `tesseract-ocr` system package to be installed on the
    backend host."""

    def extract_text(self, file_bytes: bytes, file_type: str) -> str:
        import io
        import pytesseract
        from PIL import Image

        if file_type == "pdf":
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(file_bytes)
            return "\n".join(pytesseract.image_to_string(page) for page in pages)

        image = Image.open(io.BytesIO(file_bytes))
        return pytesseract.image_to_string(image)


class MockOCRProvider(BaseOCRProvider):
    """Returns deterministic placeholder text so the extraction pipeline
    can run end-to-end without any OCR engine installed. Used automatically
    when DEMO_MODE is enabled."""

    def extract_text(self, file_bytes: bytes, file_type: str) -> str:
        logger.info("MockOCRProvider: returning demo OCR text (%d bytes, %s)", len(file_bytes), file_type)
        return (
            "DEMO OCR OUTPUT\n"
            "Invoice Number: INV-2026-0142\n"
            "Customer: Demo Customer\n"
            "Total: 1250.50\n"
        )


class OCRService:
    """Facade the rest of the app depends on. Selects a provider based on
    configuration, and never lets a provider failure crash the request —
    it logs and returns an empty string so downstream validation can flag
    the document instead."""

    def __init__(self):
        settings = get_settings()
        self.provider = self._build_provider(settings.ocr_provider, settings.demo_mode)

    @staticmethod
    def _build_provider(provider_name: str, demo_mode: bool) -> BaseOCRProvider:
        if demo_mode or provider_name == "mock":
            return MockOCRProvider()
        if provider_name == "tesseract":
            return TesseractOCRProvider()
        logger.warning("Unknown OCR_PROVIDER '%s' — falling back to mock.", provider_name)
        return MockOCRProvider()

    def extract_text(self, file_bytes: bytes, file_type: str) -> str:
        try:
            return self.provider.extract_text(file_bytes, file_type)
        except Exception:
            logger.exception("OCR extraction failed")
            return ""
