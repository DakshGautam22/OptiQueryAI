import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # General App Settings
    APP_NAME: str = Field(default="OptiQuery AI")
    DEBUG: bool = Field(default=True)
    ENVIRONMENT: str = Field(default="development")
    PORT: int = Field(default=8000)

    # Database connection URL
    DATABASE_URL: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/optiquery_ai")

    # Security and Auth
    JWT_SECRET_KEY: str = Field(default="placeholder_super_secret_jwt_key_change_in_production_32_bytes_length")
    JWT_ALGORITHM: str = Field(default="RS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    JWT_PRIVATE_KEY_PATH: str = Field(default="jwt_private.pem")
    JWT_PUBLIC_KEY_PATH: str = Field(default="jwt_public.pem")

    # Database Encryption Key (Must be 32 bytes encoded in base64 URL safe format)
    DATABASE_ENCRYPTION_KEY: str = Field(default="placeholder_32_byte_base64_encryption_key_for_db_creds=")
    CREDENTIAL_ENCRYPTION_KEY: str = Field(default="placeholder_32_byte_base64_encryption_key_for_db_creds=")

    # OpenAI API configuration
    OPENAI_API_KEY: str = Field(default="sk-proj-placeholderopenapikeyforoptiqueryai")

    # Vector store config
    CHROMA_PERSIST_DIRECTORY: str = Field(default="./chroma_db")

# Create settings singleton
settings = Settings()
