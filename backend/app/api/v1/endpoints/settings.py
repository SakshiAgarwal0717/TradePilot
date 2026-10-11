from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User
from app.schemas.entities import RiskSettingsRead, RiskSettingsUpdate
from app.crud.operations import get_risk_settings_by_user_id, update_risk_settings

router = APIRouter()


@router.get(
    "/settings",
    response_model=RiskSettingsRead,
    summary="Get user risk settings",
    description="Retrieve the risk gatekeeper settings and bounds for the authenticated user.",
)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings_obj = get_risk_settings_by_user_id(db, current_user.id)
    if not settings_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk settings not found for this user.",
        )
    return settings_obj


@router.put(
    "/settings",
    response_model=RiskSettingsRead,
    summary="Update user risk settings",
    description="Update the risk gatekeeper constraints (max risk per trade, max daily loss, etc.). Only modifies current user's settings.",
)
def update_settings(
    settings_in: RiskSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings_obj = get_risk_settings_by_user_id(db, current_user.id)
    if not settings_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk settings not found for this user.",
        )
    return update_risk_settings(db, settings_obj, settings_in)
