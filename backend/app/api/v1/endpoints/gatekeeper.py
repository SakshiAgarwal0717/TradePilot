import json
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User
from app.schemas.entities import (
    EvaluateTradeRequest,
    EvaluateTradeResponse,
    RiskEvaluationRead,
    RiskEvaluationCreate,
)
from app.services.risk_engine import evaluate_trade_risk
from app.crud.operations import (
    create_risk_evaluation,
    get_risk_evaluations_by_user_id,
    get_risk_settings_by_user_id,
)

router = APIRouter()


@router.post(
    "/evaluate",
    response_model=EvaluateTradeResponse,
    summary="Evaluate trade risk parameters",
    description="Evaluates a proposed trade against quantitative risk rules without executing an order.",
)
def evaluate_trade(
    request: EvaluateTradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fetch user's active risk settings to enforce configured limits
    user_settings = get_risk_settings_by_user_id(db, current_user.id)
    daily_limit_pct = user_settings.max_daily_loss_pct if user_settings else None
    mandatory_stop = user_settings.enforce_mandatory_stop_loss if user_settings else True

    # Pure deterministic risk engine calculation
    result = evaluate_trade_risk(
        account_equity=request.account_equity,
        risk_percentage=request.risk_percentage,
        side=request.side,
        entry_price=request.entry_price,
        stop_loss=request.stop_loss,
        target_price=request.target_price,
        min_reward_risk_ratio=request.min_reward_risk_ratio or Decimal("1.5"),
        quantity_increment=request.quantity_increment,
        daily_loss_limit_pct=daily_limit_pct,
        current_daily_losses=request.current_daily_losses,
        enforce_mandatory_stop_loss=mandatory_stop,
        max_risk_per_trade_pct=user_settings.max_risk_per_trade_pct if user_settings else None,
    )

    evaluation_id = None
    if request.save_evaluation:
        rules_checked_json = json.dumps([r.rule_name for r in result.rules])
        violations = [r.message for r in result.rules if r.status in ("FAIL", "WARNING")]
        violations_json = json.dumps(violations) if violations else None

        eval_record = create_risk_evaluation(
            db,
            user_id=current_user.id,
            eval_in=RiskEvaluationCreate(
                outcome=result.outcome,
                rules_checked=rules_checked_json,
                violation_details=violations_json,
                evaluated_risk_amount=result.projected_loss,
                evaluated_risk_pct=result.risk_percentage,
            ),
        )
        evaluation_id = eval_record.id

    return EvaluateTradeResponse(
        evaluation_id=evaluation_id,
        outcome=result.outcome,
        account_equity=result.account_equity,
        risk_budget=result.risk_budget,
        risk_percentage=result.risk_percentage,
        per_unit_risk=result.per_unit_risk,
        raw_quantity=result.raw_quantity,
        recommended_quantity=result.recommended_quantity,
        projected_loss=result.projected_loss,
        reward_to_risk_ratio=result.reward_to_risk_ratio,
        target_distance=result.target_distance,
        stop_distance=result.stop_distance,
        rules=[r.model_dump() for r in result.rules],
        summary=result.summary,
    )


@router.get(
    "/history",
    response_model=List[RiskEvaluationRead],
    summary="Get user risk evaluation history",
    description="Retrieve chronological list of past trade simulation evaluations for the authenticated user.",
)
def get_evaluation_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_risk_evaluations_by_user_id(db, user_id=current_user.id, skip=skip, limit=limit)
