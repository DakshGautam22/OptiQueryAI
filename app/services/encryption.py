import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

def _get_encryption_key() -> bytes:
    """Decodes and resolves the 32-byte AES key from settings."""
    raw_key = settings.CREDENTIAL_ENCRYPTION_KEY or settings.DATABASE_ENCRYPTION_KEY
    
    # Try parsing as standard URL-safe base64 key
    try:
        decoded = base64.urlsafe_b64decode(raw_key)
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass

    # Fallback to UTF-8 encoded bytes padded/truncated to 32 bytes for safety
    key_bytes = raw_key.encode("utf-8")
    if len(key_bytes) >= 32:
        return key_bytes[:32]
    return key_bytes.ljust(32, b"\0")


def encrypt_credential(plaintext: str, iv: bytes | None = None) -> tuple[bytes, bytes]:
    """Encrypt credential string using AES-256-GCM. Returns (ciphertext, iv)."""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    # Use provided IV, or generate a standard 12-byte random IV
    if iv is None:
        iv = os.urandom(12)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return ciphertext, iv


def decrypt_credential(ciphertext: bytes, iv: bytes) -> str:
    """Decrypt AES-256-GCM encrypted bytes back to plain string."""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
    return decrypted_bytes.decode("utf-8")
