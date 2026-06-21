from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

from app.api.auth import router as auth_router
from app.api.connections import router as connections_router
from app.api.query import router as query_router
from app.api.chat import router as chat_router
from app.api.admin import router as admin_router

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade NL-to-SQL SaaS Platform",
    version="0.1.0",
    debug=settings.DEBUG
)

# Enable CORS for the frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(connections_router, prefix="/connections", tags=["Connections"])
app.include_router(query_router, prefix="/query", tags=["Query"])
app.include_router(chat_router, prefix="/chat", tags=["Chat"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])


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
