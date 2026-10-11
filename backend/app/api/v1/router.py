from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, settings, gatekeeper, trades, analytics

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(settings.router, tags=["Settings"])
api_router.include_router(gatekeeper.router, prefix="/gatekeeper", tags=["Risk Gatekeeper"])
api_router.include_router(trades.router, prefix="/trades", tags=["Trading Journal"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Trading Analytics"])
