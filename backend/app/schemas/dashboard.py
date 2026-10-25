"""
schemas/dashboard.py
Response models for dashboard and analytics endpoints.
"""

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_documents: int
    processed_documents: int
    pending_review: int
    approved_documents: int
    rejected_documents: int
    failed_documents: int
    average_confidence: float
    processing_success_rate: float


class RecentDocument(BaseModel):
    id: str
    file_name: str
    document_type: str
    status: str
    updated_at: str


class DashboardResponse(DashboardStats):
    recent_documents: list[RecentDocument] = []
