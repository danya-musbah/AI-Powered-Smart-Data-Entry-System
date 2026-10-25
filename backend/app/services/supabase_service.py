"""
services/supabase_service.py
Thin wrapper around the Supabase client. Uses the SERVICE ROLE key because
this code only ever runs on the backend — it must never be imported into
anything that ships to the browser.

If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured (e.g. while
running in DEMO_MODE locally), get_client() returns None and callers fall
back to in-memory / mock behavior instead of crashing the app.
"""

from functools import lru_cache
from typing import Optional

from supabase import create_client, Client

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


@lru_cache
def get_client() -> Optional[Client]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase credentials not configured — running without a database connection.")
        return None
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def is_connected() -> bool:
    return get_client() is not None
