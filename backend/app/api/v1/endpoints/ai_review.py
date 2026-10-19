from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, RiskEvaluation
from app.crud.operations import get_trade_by_id_and_user
from app.schemas.ai_review import TradeReviewRequest, TradeReviewResponse
from app.services.ai_review_service import AiReviewService

router = APIRouter()


@router.post(
    "/trade/{trade_id}",
    response_model=TradeReviewResponse,
    summary="Generate AI trade review",
    description="Generates an educational, factual post-trade review using the AI Review Assistant.",
)
def review_trade(
    trade_id: int,
    review_req: TradeReviewRequest = TradeReviewRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TradeReviewResponse:
    # 1. Ownership check: Must belong to current_user
    trade = get_trade_by_id_and_user(db, trade_id=trade_id, user_id=current_user.id)
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found.",
        )

    # 2. Check for optional linked RiskEvaluation for current_user
    risk_evaluation = None
    if trade.risk_evaluation and trade.risk_evaluation.user_id == current_user.id:
        risk_evaluation = trade.risk_evaluation
    else:
        # Fallback query if relationship is not eagerly populated
        risk_evaluation = (
            db.query(RiskEvaluation)
            .filter(RiskEvaluation.trade_id == trade.id, RiskEvaluation.user_id == current_user.id)
            .first()
        )

    # 3. Generate review on-demand without mutating trade or risk data
    review_service = AiReviewService()
    review = review_service.generate_trade_review(
        trade=trade,
        risk_evaluation=risk_evaluation,
        focus_area=review_req.focus_area,
    )

    return review
