from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User
from app.services.analytics_engine import calculate_analytics, AnalyticsSummary

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(
    start_date: Optional[datetime] = Query(None, description="Start date/time in ISO format"),
    end_date: Optional[datetime] = Query(None, description="End date/time in ISO format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsSummary:
    """Returns deterministic quantitative analytics calculated from the authenticated user's trades."""
    return calculate_analytics(
        db=db,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
    )
