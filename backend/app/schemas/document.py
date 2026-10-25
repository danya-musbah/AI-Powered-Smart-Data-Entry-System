"""
schemas/document.py
Pydantic request/response models for the documents API. These are the
public contract of the API — keep them in sync with database/schema.sql.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


DocumentStatus = str  # "uploaded" | "processing" | "processed" | "needs_review" | "approved" | "rejected" | "failed"


class DocumentOut(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_url: Optional[str] = None
    document_type: str
    status: DocumentStatus
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentOut]
    total: int


class DocumentUploadResponse(BaseModel):
    id: str
    file_name: str
    status: DocumentStatus
    message: str = "Document uploaded. Call /process to run OCR + AI extraction."


class ProcessDocumentResponse(BaseModel):
    id: str
    status: DocumentStatus
    fields_extracted: int
    requires_review: bool


class ApprovalResponse(BaseModel):
    id: str
    status: DocumentStatus


class ErrorResponse(BaseModel):
    detail: str
