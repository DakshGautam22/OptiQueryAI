from fastapi import FastAPI
from app.core.config import settings

from app.api.auth import router as auth_router
from app.api.connections import router as connections_router

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade NL-to-SQL SaaS Platform",
    version="0.1.0",
    debug=settings.DEBUG
)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(connections_router, prefix="/connections", tags=["Connections"])


@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint to verify service uptime and basic configurations."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "debug_mode": settings.DEBUG
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=settings.DEBUG)
