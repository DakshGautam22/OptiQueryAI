import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt, JWTError
from fastapi import HTTPException, status
from passlib.context import CryptContext
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from app.core.config import settings

# Configure passlib crypt context with bcrypt work factor 12
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

PRIVATE_KEY_PATH = settings.JWT_PRIVATE_KEY_PATH
PUBLIC_KEY_PATH = settings.JWT_PUBLIC_KEY_PATH

def _ensure_rsa_keys_exist() -> None:
    """Helper to auto-generate RSA key pair for RS256 signing if files do not exist."""
    if not os.path.exists(PRIVATE_KEY_PATH) or not os.path.exists(PUBLIC_KEY_PATH):
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        
        # Serialize private key to PEM
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        # Serialize public key to PEM
        public_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        # Write keys to disk
        with open(PRIVATE_KEY_PATH, "wb") as f:
            f.write(private_pem)
        with open(PUBLIC_KEY_PATH, "wb") as f:
            f.write(public_pem)

# Initialize keys on import
_ensure_rsa_keys_exist()

# Read RSA key bytes
with open(PRIVATE_KEY_PATH, "r", encoding="utf-8") as f:
    PRIVATE_KEY_PEM = f.read()

with open(PUBLIC_KEY_PATH, "r", encoding="utf-8") as f:
    PUBLIC_KEY_PEM = f.read()


def hash_password(password: str) -> str:
    """Hash a plain password using bcrypt (cost 12)."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against the hashed database value."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    """Create an RS256 access token valid for 1 hour."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=1)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": expire
    }
    return jwt.encode(payload, PRIVATE_KEY_PEM, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: uuid.UUID) -> str:
    """Create an RS256 refresh token valid for 7 days."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=7)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": expire
    }
    return jwt.encode(payload, PRIVATE_KEY_PEM, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict[str, Any]:
    """Verify a token's RS256 signature and return the decoded payload."""
    try:
        payload = jwt.decode(
            token,
            PUBLIC_KEY_PEM,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
