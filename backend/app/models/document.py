"""
models/document.py
Table-name constants and status enums for the `documents`,
`extracted_fields`, and `processing_logs` tables (see database/schema.sql).

The project uses Supabase's Python client rather than a full ORM, so
"models" here means the shared vocabulary (table names, allowed status
values) that routes/ and services/ both import from — avoiding magic
strings scattered across the codebase.
"""

DOCUMENTS_TABLE = "documents"
EXTRACTED_FIELDS_TABLE = "extracted_fields"
PROCESSING_LOGS_TABLE = "processing_logs"

DOCUMENT_STATUSES = (
    "uploaded",
    "processing",
    "processed",
    "needs_review",
    "approved",
    "rejected",
    "failed",
)

PROCESSING_STAGES = ("upload", "ocr", "ai_extraction", "validation")
