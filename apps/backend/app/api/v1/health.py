import structlog
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])
logger = structlog.get_logger()


class HealthResponse(BaseModel):
    status: str


class ReadinessResponse(BaseModel):
    status: str
    database: str
    redis: str
    workers: str


@router.get("/live", response_model=HealthResponse)
async def liveness_probe() -> HealthResponse:
    """Returns 200 OK if the application process is running."""
    return HealthResponse(status="ok")


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_probe() -> ReadinessResponse:
    """Checks dependencies like Database, Redis, and Workers."""
    # Placeholder for actual connectivity checks in Phase 1
    return ReadinessResponse(
        status="ok", database="pending", redis="pending", workers="pending"
    )


@router.get("/startup", response_model=HealthResponse)
async def startup_probe() -> HealthResponse:
    """Checks if the application has finished initialization."""
    return HealthResponse(status="ok")
