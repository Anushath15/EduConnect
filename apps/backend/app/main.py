from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


def create_app() -> FastAPI:
    """Application factory for EduConnect FastAPI backend."""
    settings = get_settings()

    # Configure logging
    setup_logging(settings.log_level)

    app = FastAPI(
        title=settings.project_name,
        description="Enterprise-grade Education ERP Platform",
        version="0.1.0",
        openapi_url=f"{settings.api_v1_str}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        generate_unique_id_function=custom_generate_unique_id,
        contact={
            "name": "EduConnect Platform Team",
        },
    )

    # Include Routers
    app.include_router(api_router, prefix=settings.api_v1_str)

    return app


# The global app instance is created here for ASGI servers like Uvicorn
app: FastAPI = create_app()
