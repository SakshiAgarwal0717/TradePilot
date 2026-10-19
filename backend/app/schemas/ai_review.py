from typing import List, Annotated
from pydantic import BaseModel, Field, StringConstraints

ReviewItem = Annotated[str, StringConstraints(min_length=1, max_length=500, strip_whitespace=True)]


class TradeReviewRequest(BaseModel):
    """Optional review configuration parameter overrides."""
    focus_area: str = Field(
        default="general",
        description="Optional focal area for the review, e.g. 'risk', 'execution', 'discipline'.",
        max_length=50,
    )


class TradeReviewResponse(BaseModel):
    """Validated structured output for an AI trade review."""
    trade_id: int = Field(description="Database ID of the reviewed trade")
    symbol: str = Field(description="Ticker symbol of the trade")
    strengths: List[ReviewItem] = Field(
        description="Observed disciplined actions supported by available trade metrics.",
        min_length=1,
        max_length=10,
    )
    improvement_areas: List[ReviewItem] = Field(
        description="Specific potential execution improvements supported by trade metrics.",
        min_length=1,
        max_length=10,
    )
    evidence: List[ReviewItem] = Field(
        description="Factual observations tied directly to persisted trade fields.",
        min_length=1,
        max_length=15,
    )
    lessons_learned: List[ReviewItem] = Field(
        description="Practical, objective takeaways for future trade execution.",
        min_length=1,
        max_length=10,
    )
    disclaimer: str = Field(
        default=(
            "This review is an educational decision-support summary derived strictly from recorded "
            "trade data. It does not constitute financial or investment advice, nor does it guarantee "
            "future performance or infer psychological diagnosis."
        ),
        max_length=1000,
        description="Mandatory compliance and decision-support disclaimer.",
    )
