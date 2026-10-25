"""
file_utils.py
Helpers for validating and naming uploaded files.
"""

import uuid
from pathlib import Path

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}


def is_allowed_file(filename: str, content_type: str | None) -> bool:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        return False
    return True


def generate_storage_key(original_filename: str) -> str:
    """Produces a collision-safe storage path, preserving the extension
    so downstream OCR tools can infer file type."""
    ext = Path(original_filename).suffix.lower()
    return f"{uuid.uuid4().hex}{ext}"


def guess_document_type(filename: str) -> str:
    """Best-effort default document type based on filename, used only as
    a fallback before AI classification runs."""
    name = filename.lower()
    if "invoice" in name:
        return "invoice"
    if "receipt" in name:
        return "receipt"
    if "po_" in name or "purchase" in name:
        return "purchase_order"
    if "customer" in name or "intake" in name or "form" in name:
        return "customer_form"
    return "general_document"
