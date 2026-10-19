from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import setup_exception_handlers
from app.api.v1.router import api_router
from app.db.session import init_db
from app.services.ai_provider import sanitize_ssl_environment

# Ensure any dangling SSL environment variables are sanitized on startup
sanitize_ssl_environment()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure runtime environment is sanitized
    sanitize_ssl_environment()
    # Initialize SQLite database schema on startup
    init_db()
    yield
    # Cleanup tasks on shutdown (if any)


def create_application() -> FastAPI:
    app = FastAPI(
        title=f"{settings.PROJECT_NAME} API",
        description="Risk-aware trading journal and decision-support platform backend engine.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Configure CORS with local Vite and explicitly allowed origins
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.BACKEND_CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allow_headers=["*"],
        )

    # Setup standard, consistent error response structure
    setup_exception_handlers(app)

    # Include versioned API routers
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_application()
