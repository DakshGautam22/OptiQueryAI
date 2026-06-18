import pytest
from app.services.encryption import encrypt_credential, decrypt_credential

def test_encryption_decryption_roundtrip():
    plaintext = "super_secret_db_password_123!"
    
    # 1. Encrypt
    ciphertext, iv = encrypt_credential(plaintext)
    
    assert ciphertext != plaintext.encode()
    assert len(iv) == 12  # standard GCM IV size
    
    # 2. Decrypt
    decrypted = decrypt_credential(ciphertext, iv)
    assert decrypted == plaintext

def test_encryption_reusable_iv():
    plaintext_1 = "host.database.local"
    plaintext_2 = "admin_user"
    
    # 1. Encrypt first string
    ciphertext_1, iv_1 = encrypt_credential(plaintext_1)
    
    # 2. Encrypt second string using same IV
    ciphertext_2, iv_2 = encrypt_credential(plaintext_2, iv_1)
    
    assert iv_1 == iv_2
    assert ciphertext_1 != ciphertext_2
    
    # 3. Decrypt both and verify correctness
    decrypted_1 = decrypt_credential(ciphertext_1, iv_1)
    decrypted_2 = decrypt_credential(ciphertext_2, iv_2)
    
    assert decrypted_1 == plaintext_1
    assert decrypted_2 == plaintext_2
