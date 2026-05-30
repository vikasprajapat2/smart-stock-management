import bcrypt

def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password against its bcrypt hash. Returns False on any hash parsing error."""
    try:
        # If the hash in the database is not a valid bcrypt hash, return False
        if not hashed_password or not hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            return False
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False