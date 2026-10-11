from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, EvaluationOutcome, TradeStatus, TradeSide, RiskEvaluation
from app.schemas.entities import TradeCreate, TradeUpdate, TradeRead
from app.crud.operations import (
    create_trade,
    update_trade,
    delete_trade,
    get_trade_by_id_and_user,
    get_trades_by_user_id,
)

router = APIRouter()


class PaginatedTradesResponse(BaseModel):
    items: List[TradeRead]
    total: int
    skip: int
    limit: int


@router.post(
    "/",
    response_model=TradeRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record trade in journal",
    description="Save a trade to the user's trading journal. Validates required exit info if marked CLOSED.",
)
def record_trade(
    trade_in: TradeCreate,
    evaluation_id: Optional[int] = Query(None, description="Optional associated RiskEvaluation ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validation: Closed trades require exit_price
    if trade_in.status == TradeStatus.CLOSED and trade_in.exit_price is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A closed trade must have an exit price specified.",
        )

    # Price relationships validation
    if trade_in.status == TradeStatus.CLOSED and trade_in.exit_price is not None:
        if trade_in.exit_price <= Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Exit price must be positive.",
            )

    eval_record = None
    if evaluation_id is not None:
        eval_record = db.query(RiskEvaluation).filter(
            RiskEvaluation.id == evaluation_id,
            RiskEvaluation.user_id == current_user.id,
        ).first()

        if not eval_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Referenced risk evaluation not found.",
            )

        # Enforce requirement: A rejected trade must not be silently saved as approved
        if eval_record.outcome == EvaluationOutcome.REJECTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A rejected trade evaluation cannot be saved as an approved journal entry.",
            )

    created = create_trade(db, user_id=current_user.id, trade_in=trade_in)

    # Link evaluation if provided
    if evaluation_id is not None and eval_record:
        eval_record.trade_id = created.id
        db.add(eval_record)
        db.commit()

    return created


@router.get(
    "/",
    response_model=PaginatedTradesResponse,
    summary="List user trades with filters and pagination",
)
def list_trades(
    status: Optional[TradeStatus] = Query(None, description="Filter by status (DRAFT, OPEN, CLOSED, etc.)"),
    side: Optional[TradeSide] = Query(None, description="Filter by side (LONG, SHORT)"),
    symbol: Optional[str] = Query(None, description="Search ticker symbol"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    sort_by: str = Query("entry_time", description="Field to sort by"),
    sort_desc: bool = Query(True, description="Descending sort"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = get_trades_by_user_id(
        db,
        user_id=current_user.id,
        status=status,
        side=side,
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        sort_by=sort_by,
        sort_desc=sort_desc,
        skip=skip,
        limit=limit,
    )
    return PaginatedTradesResponse(items=items, total=total, skip=skip, limit=limit)


@router.get(
    "/{trade_id}",
    response_model=TradeRead,
    summary="Get single trade by ID",
)
def get_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trade = get_trade_by_id_and_user(db, trade_id=trade_id, user_id=current_user.id)
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found.",
        )
    return trade


@router.put(
    "/{trade_id}",
    response_model=TradeRead,
    summary="Update trade details or status",
)
def modify_trade(
    trade_id: int,
    trade_in: TradeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_trade = get_trade_by_id_and_user(db, trade_id=trade_id, user_id=current_user.id)
    if not current_trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found.",
        )

    # Target status check
    new_status = trade_in.status if trade_in.status is not None else current_trade.status
    new_exit_price = trade_in.exit_price if trade_in.exit_price is not None else current_trade.exit_price

    if new_status == TradeStatus.CLOSED and new_exit_price is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Closing a trade requires specifying an exit price.",
        )

    return update_trade(db, current_trade=current_trade, trade_in=trade_in)


@router.delete(
    "/{trade_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a trade entry",
)
def remove_trade(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_trade = get_trade_by_id_and_user(db, trade_id=trade_id, user_id=current_user.id)
    if not current_trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trade not found.",
        )
    delete_trade(db, current_trade=current_trade)
    return None
