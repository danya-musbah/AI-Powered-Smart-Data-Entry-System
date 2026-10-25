"""
schemas/field.py
Pydantic models for extracted fields — the structured output of the
AI extraction layer, and the payload the review UI edits and saves.
"""

from typing import Optional
from pydantic import BaseModel, Field


class ExtractedField(BaseModel):
    field_name: str
    field_value: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    requires_review: bool = False


class FieldsResponse(BaseModel):
    document_id: str
    fields: list[ExtractedField]


class UpdateFieldsRequest(BaseModel):
    fields: list[ExtractedField]


class ValidationIssue(BaseModel):
    field_name: str
    messages: list[str]


class ValidationReport(BaseModel):
    document_id: str
    issues: list[ValidationIssue]
    has_blocking_errors: bool
