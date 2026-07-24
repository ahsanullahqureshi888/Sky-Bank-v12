from app.database import SessionLocal
from app.models import User
from app.auth.security import verify_password

db = SessionLocal()
ahsan = db.query(User).filter_by(email='ahsan@sky.com').first()
if ahsan:
    print(f'Hash in DB: {ahsan.password_hash}')
    print(f'Verification result: {verify_password("Qur78Ahs@@", ahsan.password_hash)}')
else:
    print("User not found!")
