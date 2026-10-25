"""
routes/dashboard.py
Aggregate statistics for the dashboard and analytics views.
"""

from fastapi import APIRouter, HTTPException

from app.models.document import DOCUMENTS_TABLE, EXTRACTED_FIELDS_TABLE
from app.services.supabase_service import get_client
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/stats")
async def get_dashboard_stats():
    client = get_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, "
                   "or use the frontend's Demo Mode (?demo=1) to explore without a backend.",
        )

    docs_res = client.table(DOCUMENTS_TABLE).select("*").execute()
    documents = docs_res.data or []

    fields_res = client.table(EXTRACTED_FIELDS_TABLE).select("confidence_score").execute()
    confidences = [f["confidence_score"] for f in (fields_res.data or [])]

    total = len(documents)
    by_status = lambda s: len([d for d in documents if d["status"] == s])  # noqa: E731
    processed = len([d for d in documents if d["status"] in ("processed", "needs_review", "approved", "rejected")])
    failed = by_status("failed")

    return {
        "total_documents": total,
        "processed_documents": processed,
        "pending_review": by_status("needs_review"),
        "approved_documents": by_status("approved"),
        "rejected_documents": by_status("rejected"),
        "failed_documents": failed,
        "average_confidence": (sum(confidences) / len(confidences)) if confidences else 0.0,
        "processing_success_rate": ((total - failed) / total * 100) if total else 0.0,
        "recent_documents": sorted(documents, key=lambda d: d["updated_at"], reverse=True)[:6],
    }
