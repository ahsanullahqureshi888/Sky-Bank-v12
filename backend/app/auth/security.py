import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone


JWT_SECRET = os.getenv("JWT_SECRET", "change-this-local-secret")
TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    parts = password_hash.split("$")
    try:
        if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
            # Django format: pbkdf2_sha256$iterations$salt$hash
            iterations = int(parts[1])
            salt = parts[2]
            digest = parts[3]
            check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
            # Compare hex or base64
            if hmac.compare_digest(check.hex(), digest):
                return True
            import base64
            if hmac.compare_digest(base64.b64encode(check).decode().rstrip("="), digest.rstrip("=")):
                return True
        elif len(parts) == 3 and parts[0] == "pbkdf2_sha256":
            # Native format: pbkdf2_sha256$salt$digest
            salt = parts[1]
            digest = parts[2]
            check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180_000).hex()
            if hmac.compare_digest(check, digest):
                return True
            # Try 260_000 and 100_000 iterations fallback
            for iter_count in (260_000, 100_000, 600_000):
                check_alt = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iter_count).hex()
                if hmac.compare_digest(check_alt, digest):
                    return True
        elif password == password_hash:
            return True
    except Exception:
        pass
    return False


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_access_token(subject: str, role: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "role": role,
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES)).timestamp()),
    }
    signing_input = f"{_b64(json.dumps(header).encode())}.{_b64(json.dumps(payload).encode())}"
    signature = hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64(signature)}"


def decode_token(token: str) -> dict:
    try:
        header, payload, signature = token.split(".")
        expected = _b64(hmac.new(JWT_SECRET.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid token signature")
        decoded = json.loads(_unb64(payload))
        if int(decoded["exp"]) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("Token expired")
        return decoded
    except Exception as exc:
        raise ValueError("Invalid token") from exc
