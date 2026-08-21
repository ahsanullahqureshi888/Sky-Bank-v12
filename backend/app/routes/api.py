import csv
import io
import json
import re
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, Request
from fastapi.responses import HTMLResponse, Response, StreamingResponse, FileResponse, RedirectResponse
from sqlalchemy import delete, func, select, update, Date, DateTime, text
from sqlalchemy.orm import Session
import zipfile
import os


from .. import models, schemas
from ..auth.dependencies import get_current_user, require_role
from ..auth.security import create_access_token, hash_password, verify_password
from ..database import get_db
from ..services.ledger import log_action, recalculate_after_transaction, recalculate_bank_ledger, recalculate_customer_ledger



router = APIRouter()
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"


def get_blob_token() -> str | None:
    """Return the Blob write token when available.

    BLOB_STORE_ID identifies a store but cannot authenticate uploads. When the
    token is unavailable, uploads intentionally use the local persistent
    fallback instead of failing the transaction flow.
    """
    return os.getenv("BLOB_READ_WRITE_TOKEN") or os.getenv("VERCEL_BLOB_READ_WRITE_TOKEN")


def safe_upload_name(filename: str | None, prefix: str) -> str:
    original = Path(filename or "upload.bin").name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", original).strip(".-") or "upload.bin"
    return f"{prefix}-{cleaned}"


def log_api_action(request: Request, db: Session, user_id: int | None, action: str, table_name: str, record_id: int | None, description: str) -> None:
    ip = request.client.host if request.client else None
    device = request.headers.get("user-agent")
    log_action(db, user_id, action, table_name, record_id, description, ip_address=ip, device_info=device)


def serialize_table(db: Session, model) -> list[dict]:
    results = []
    for row in db.scalars(select(model)).all():
        row_dict = {}
        for col in model.__table__.columns:
            val = getattr(row, col.name)
            if val is not None:
                if isinstance(val, (date, datetime)):
                    row_dict[col.name] = val.isoformat()
                else:
                    row_dict[col.name] = val
        results.append(row_dict)
    return results


def import_table_data(db: Session, model, data_list: list[dict]) -> None:
    for item in data_list:
        parsed_item = {}
        for col in model.__table__.columns:
            val = item.get(col.name)
            if val is not None:
                if isinstance(col.type, Date) and isinstance(val, str):
                    try:
                        parsed_item[col.name] = date.fromisoformat(val[:10])
                    except Exception:
                        parsed_item[col.name] = date.today()
                elif isinstance(col.type, DateTime) and isinstance(val, str):
                    cleaned_val = val.replace("Z", "+00:00")
                    try:
                        parsed_item[col.name] = datetime.fromisoformat(cleaned_val)
                    except Exception:
                        try:
                            fmt = "%Y-%m-%d %H:%M:%S" if " " in val else "%Y-%m-%dT%H:%M:%S"
                            parsed_item[col.name] = datetime.strptime(val[:19], fmt)
                        except Exception:
                            parsed_item[col.name] = datetime.utcnow()
                else:
                    parsed_item[col.name] = val
        row = model(**parsed_item)
        db.add(row)




def transaction_to_dict(transaction: models.Transaction) -> dict:
    return {
        "id": transaction.id,
        "receipt_no": transaction.receipt_no,
        "date": transaction.date,
        "type": transaction.type,
        "customer_id": transaction.customer_id,
        "customer_name": transaction.customer.name if transaction.customer else None,
        "company_name": transaction.company_name,
        "subject": transaction.subject,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "equivalent_amount": transaction.equivalent_amount,
        "equivalent_currency": transaction.equivalent_currency,
        "payment_method": transaction.payment_method,
        "bank_account_id": transaction.bank_account_id,
        "receiver_name": transaction.receiver_name,
        "description": transaction.description,
        "status": transaction.status,
        "attachment_path": transaction.attachment_path,
        "created_by": transaction.created_by,
        "created_at": transaction.created_at,
        "updated_at": transaction.updated_at,
    }


def get_or_create_customer(db: Session, payload: schemas.TransactionBase) -> models.Customer:
    if payload.customer_id:
        customer = db.get(models.Customer, payload.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer
    if not payload.customer_name:
        raise HTTPException(status_code=422, detail="customer_id or customer_name is required")
    customer = db.scalar(select(models.Customer).where(models.Customer.name == payload.customer_name))
    if customer:
        return customer
    customer = models.Customer(name=payload.customer_name)
    db.add(customer)
    db.flush()
    return customer


def make_pdf(content: str) -> bytes:
    stream = f"{content}\n"
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}endstream",
    ]
    pdf = "%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f"{index} 0 obj\n{obj}\nendobj\n"
    xref = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n"
    pdf += f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
    return pdf.encode("latin-1")


def pdf_text(value: object) -> str:
    return re.sub(r"[^\x20-\x7E]", "", str(value or "")).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def transaction_pdf(transaction: models.Transaction, settings: models.Settings | None) -> bytes:
    bank = transaction.bank_account
    fields = [
        ("Customer", transaction.customer.name if transaction.customer else "-"),
        ("Company", transaction.company_name or "-"),
        ("Subject", transaction.subject),
        ("Amount", f"{transaction.amount:,.2f} {transaction.currency}"),
        ("Equivalent", f"{transaction.equivalent_amount:,.2f} {transaction.equivalent_currency}"),
        ("Payment Method", transaction.payment_method),
        ("Bank Account", f"{bank.account_name} - {bank.account_number}" if bank else "-"),
        ("Receiver", transaction.receiver_name or "-"),
        ("Status", transaction.status),
        ("Notes", transaction.description or "-"),
    ]
    company = settings.company_name if settings else "Balam Bar Baran International Transport"
    address = settings.address if settings else "Kabul, Afghanistan"
    footer = settings.receipt_footer if settings else "Official receipt generated by Sky Banking."
    lines = [
        "q 0.058 0.42 0.86 rg 48 734 64 64 re f Q",
        "BT /F2 18 Tf 1 1 1 rg 67 757 Td (BB) Tj ET",
        f"BT /F2 18 Tf 0.06 0.14 0.25 rg 128 776 Td ({pdf_text(company)}) Tj ET",
        f"BT /F1 10 Tf 0.32 0.44 0.56 rg 128 758 Td ({pdf_text(address)}) Tj ET",
        "0.058 0.42 0.86 RG 48 718 m 547 718 l S",
        "BT /F2 16 Tf 0.06 0.14 0.25 rg 48 680 Td (Money Transaction Receipt) Tj ET",
        f"BT /F1 11 Tf 0.06 0.14 0.25 rg 48 650 Td (Receipt No: {pdf_text(transaction.receipt_no)}) Tj ET",
        f"BT /F1 11 Tf 0.06 0.14 0.25 rg 360 650 Td (Date: {pdf_text(transaction.date)}) Tj ET",
    ]
    for index, (label, value) in enumerate(fields):
        y = 610 - index * 30
        lines.append(f"BT /F2 10 Tf 0.32 0.44 0.56 rg 56 {y} Td ({pdf_text(label)}) Tj ET")
        lines.append(f"BT /F1 11 Tf 0.06 0.14 0.25 rg 205 {y} Td ({pdf_text(str(value)[:54])}) Tj ET")
        lines.append(f"0.86 0.91 0.97 RG 48 {y - 10} m 547 {y - 10} l S")
    lines.extend(
        [
            "0.55 0.64 0.73 RG 72 138 m 180 138 l S 244 138 m 352 138 l S 416 138 m 524 138 l S",
            "BT /F1 9 Tf 0.32 0.44 0.56 rg 96 122 Td (Prepared By) Tj ET",
            "BT /F1 9 Tf 0.32 0.44 0.56 rg 258 122 Td (Customer Signature) Tj ET",
            "BT /F1 9 Tf 0.32 0.44 0.56 rg 437 122 Td (Company Stamp) Tj ET",
            f"BT /F1 9 Tf 0.32 0.44 0.56 rg 48 78 Td ({pdf_text(footer)}) Tj ET",
        ]
    )
    return make_pdf("\n".join(lines))


@router.get("/health")
def health_check():
    return {"status": "healthy", "system": "Sky Bank v12", "timestamp": datetime.utcnow().isoformat()}


@router.get("/health/db-check")
def db_health_check(db: Session = Depends(get_db)):
    try:
        users_count = db.scalar(select(func.count(models.User.id)))
        customers_count = db.scalar(select(func.count(models.Customer.id)))
        transactions_count = db.scalar(select(func.count(models.Transaction.id)))
        banks_count = db.scalar(select(func.count(models.BankAccount.id)))
        return {
            "status": "connected",
            "database": "sky_banking.db",
            "users": users_count,
            "customers": customers_count,
            "transactions": transactions_count,
            "bank_accounts": banks_count,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database health check failed: {exc}") from exc


@router.post("/auth/register", response_model=schemas.UserRead)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin"))):
    if db.scalar(select(models.User).where(models.User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email already registered")
    if payload.username and db.scalar(select(models.User).where(models.User.username == payload.username)):
        raise HTTPException(status_code=409, detail="Username already registered")
    record = models.User(name=payload.name, username=payload.username, email=payload.email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(record)
    db.flush()
    log_action(db, user.id, "create", "users", record.id, f"Created user {record.email}")
    db.commit()
    db.refresh(record)
    return record


@router.post("/auth/login", response_model=schemas.Token)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    identifier = payload.identifier.strip().lower()
    user = db.scalar(
        select(models.User).where(
            (func.lower(models.User.email) == identifier) | (func.lower(models.User.username) == identifier)
        )
    )
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": create_access_token(str(user.id), user.role), "user": user}


@router.get("/auth/me", response_model=schemas.UserRead)
def me(user: models.User = Depends(get_current_user)):
    return user

@router.get("/auth/users", response_model=list[schemas.UserRead])
def list_users(db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin"))):
    return db.scalars(select(models.User).order_by(models.User.name)).all()


@router.put("/auth/users/{user_id}", response_model=schemas.UserRead)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin"))):
    record = db.get(models.User, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="User not found")

    update = payload.model_dump(exclude_unset=True)
    if "email" in update and update["email"] != record.email:
        existing = db.scalar(select(models.User).where(models.User.email == update["email"], models.User.id != user_id))
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
    if "username" in update and update["username"] != record.username:
        existing = db.scalar(select(models.User).where(models.User.username == update["username"], models.User.id != user_id))
        if existing:
            raise HTTPException(status_code=409, detail="Username already registered")

    for field in ("name", "username", "email", "role"):
        if field in update and update[field] is not None:
            setattr(record, field, update[field])

    log_action(db, user.id, "update", "users", record.id, f"Updated user profile for {record.email}")
    db.commit()
    db.refresh(record)
    return record


@router.put("/auth/users/{user_id}/password")
def update_user_password(user_id: int, payload: schemas.UserPasswordUpdate, db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin"))):
    record = db.get(models.User, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="User not found")

    record.password_hash = hash_password(payload.password)
    log_action(db, user.id, "update", "users", record.id, f"Changed password for {record.email}")
    db.commit()
    return {"ok": True, "message": "Password updated successfully."}


@router.put("/auth/users/{user_id}/toggle", response_model=schemas.UserRead)
def toggle_user_active(user_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin"))):
    record = db.get(models.User, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="User not found")
    if record.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot disable yourself")
    record.is_active = not record.is_active
    log_action(db, user.id, "update", "users", record.id, f"Toggled user active status for {record.email}")
    db.commit()
    db.refresh(record)
    return record


@router.delete("/auth/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin"))):
    record = db.get(models.User, user_id)
    if not record:
        raise HTTPException(status_code=404, detail="User not found")
    if record.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    email = record.email
    db.execute(update(models.Transaction).where(models.Transaction.created_by == user_id).values(created_by=None))
    db.execute(update(models.AuditLog).where(models.AuditLog.user_id == user_id).values(user_id=None))
    db.delete(record)
    log_action(db, user.id, "delete", "users", user_id, f"Deleted user {email}")
    db.commit()
    return {"ok": True, "message": "User deleted successfully."}



@router.get("/customers", response_model=list[schemas.CustomerRead])
def list_customers(
    entity_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user)
):
    query = select(models.Customer)
    if entity_type:
        query = query.where(models.Customer.entity_type == entity_type)
    return db.scalars(query.order_by(models.Customer.name)).all()


@router.post("/customers", response_model=schemas.CustomerRead)
def create_customer(
    request: Request,
    payload: schemas.CustomerCreate, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin", "Accountant"))
):
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.flush()
    log_api_action(request, db, user.id, "create", "customers", customer.id, f"Created customer {customer.name}")
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/customers/{customer_id}", response_model=schemas.CustomerRead)
def get_customer(customer_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    customer = db.get(models.Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/customers/{customer_id}", response_model=schemas.CustomerRead)
def update_customer(
    request: Request,
    customer_id: int, 
    payload: schemas.CustomerUpdate, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin", "Accountant"))
):
    customer = db.get(models.Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    try:
        log_api_action(request, db, user.id, "update", "customers", customer.id, f"Updated customer {customer.name}")
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Customer update failed. No changes were saved.") from exc
    db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}")
def delete_customer(
    request: Request,
    customer_id: int, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    customer = db.get(models.Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if customer has transactions
    has_tx = db.scalar(select(models.Transaction).where(models.Transaction.customer_id == customer_id).limit(1))
    if has_tx:
        raise HTTPException(status_code=400, detail="Cannot delete customer because they have transaction history.")
        
    db.delete(customer)
    log_api_action(request, db, user.id, "delete", "customers", customer_id, f"Deleted customer {customer.name}")
    db.commit()
    return {"ok": True}



@router.get("/bank-accounts", response_model=list[schemas.BankAccountRead])
def list_bank_accounts(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return db.scalars(select(models.BankAccount).order_by(models.BankAccount.account_name)).all()


@router.post("/bank-accounts", response_model=schemas.BankAccountRead)
def create_bank_account(
    request: Request,
    payload: schemas.BankAccountCreate, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin", "Accountant"))
):
    account = models.BankAccount(**payload.model_dump(), current_balance=payload.opening_balance)
    db.add(account)
    db.flush()
    log_api_action(request, db, user.id, "create", "bank_accounts", account.id, f"Created bank account {account.account_number}")
    db.commit()
    db.refresh(account)
    return account


@router.get("/bank-accounts/{account_id}", response_model=schemas.BankAccountRead)
def get_bank_account(account_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    account = db.get(models.BankAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.put("/bank-accounts/{account_id}", response_model=schemas.BankAccountRead)
def update_bank_account(
    request: Request,
    account_id: int, 
    payload: schemas.BankAccountUpdate, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin", "Accountant"))
):
    account = db.get(models.BankAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, key, value)
    recalculate_bank_ledger(db, account.id)
    log_api_action(request, db, user.id, "update", "bank_accounts", account.id, f"Updated bank account {account.account_number}")
    db.commit()
    db.refresh(account)
    return account


@router.delete("/bank-accounts/{account_id}")
def delete_bank_account(
    request: Request,
    account_id: int, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    account = db.get(models.BankAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
        
    # Check if bank account has transactions
    has_tx = db.scalar(select(models.Transaction).where(models.Transaction.bank_account_id == account_id).limit(1))
    if has_tx:
        raise HTTPException(status_code=400, detail="Cannot delete bank account because it has transaction history.")
        
    db.delete(account)
    log_api_action(request, db, user.id, "delete", "bank_accounts", account_id, f"Deleted bank account {account.account_number}")
    db.commit()
    return {"ok": True}




@router.get("/transactions")
def list_transactions(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    customer: Optional[str] = None,
    search: Optional[str] = None,
    currency: Optional[str] = None,
    bank_account_id: Optional[int] = None,
    payment_method: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    amount_min: Optional[float] = None,
    amount_max: Optional[float] = None,
    created_by: Optional[int] = None,
    type: Optional[str] = None,
):
    query = select(models.Transaction).join(models.Customer).order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            (models.Customer.name.ilike(pattern))
            | (models.Transaction.receipt_no.ilike(pattern))
            | (models.Transaction.subject.ilike(pattern))
            | (models.Transaction.company_name.ilike(pattern))
            | (models.Transaction.description.ilike(pattern))
            | (models.Transaction.receiver_name.ilike(pattern))
        )
    if customer:
        query = query.where(models.Customer.name.ilike(f"%{customer}%"))
    if currency:
        query = query.where(models.Transaction.currency == currency)
    if bank_account_id:
        query = query.where(models.Transaction.bank_account_id == bank_account_id)
    if payment_method:
        query = query.where(models.Transaction.payment_method == payment_method)
    if status:
        query = query.where(models.Transaction.status == status)
    if date_from:
        query = query.where(models.Transaction.date >= date_from)
    if date_to:
        query = query.where(models.Transaction.date <= date_to)
    if amount_min is not None:
        query = query.where(models.Transaction.amount >= amount_min)
    if amount_max is not None:
        query = query.where(models.Transaction.amount <= amount_max)
    if created_by is not None:
        query = query.where(models.Transaction.created_by == created_by)
    if type:
        query = query.where(models.Transaction.type == type)
    return [transaction_to_dict(item) for item in db.scalars(query).all()]



@router.post("/transactions")
def create_transaction(
    request: Request,
    payload: schemas.TransactionCreate, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin", "Accountant"))
):
    if payload.amount < 0:
        raise HTTPException(status_code=400, detail="Transaction amount cannot be negative.")
    if payload.equivalent_amount < 0:
        raise HTTPException(status_code=400, detail="Equivalent amount cannot be negative.")
        
    # Check duplicate receipt number
    exists = db.scalar(select(models.Transaction).where(models.Transaction.receipt_no == payload.receipt_no))
    if exists:
        raise HTTPException(status_code=400, detail=f"Duplicate receipt number '{payload.receipt_no}' already exists.")
        
    customer = get_or_create_customer(db, payload)
    transaction = models.Transaction(
        **payload.model_dump(exclude={"customer_name", "customer_id"}), 
        customer_id=customer.id, 
        created_by=user.id
    )
    db.add(transaction)
    db.flush()
    
    # Auto-increment setting count if it matches the prefix (legacy format only)
    settings = db.scalar(select(models.Settings).limit(1))
    if settings:
        prefix = settings.receipt_prefix or "TX"
        # Legacy format: PREFIX-0001 (two parts). Skip currency format: PREFIX-CURR-0001 (three parts)
        parts = transaction.receipt_no.split("-")
        if len(parts) == 2 and transaction.receipt_no.startswith(f"{prefix}-"):
            try:
                num_part = int(parts[-1])
                if num_part >= settings.next_receipt_number:
                    settings.next_receipt_number = num_part + 1
            except ValueError:
                pass
                
    recalculate_after_transaction(db, transaction)
    log_api_action(request, db, user.id, "create", "transactions", transaction.id, f"Added transaction {transaction.receipt_no}")
    db.commit()
    db.refresh(transaction)
    return transaction_to_dict(transaction)


@router.get("/transactions/{transaction_id}")
def get_transaction(transaction_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction_to_dict(transaction)


@router.put("/transactions/{transaction_id}")
def update_transaction(
    request: Request,
    transaction_id: int, 
    payload: schemas.TransactionUpdate, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin", "Accountant"))
):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    update = payload.model_dump(exclude_unset=True)
    
    # Check negative amount
    if "amount" in update and update["amount"] < 0:
        raise HTTPException(status_code=400, detail="Transaction amount cannot be negative.")
    if "equivalent_amount" in update and update["equivalent_amount"] < 0:
        raise HTTPException(status_code=400, detail="Equivalent amount cannot be negative.")
        
    # Check duplicate receipt_no
    if "receipt_no" in update and update["receipt_no"] != transaction.receipt_no:
        exists = db.scalar(select(models.Transaction).where(models.Transaction.receipt_no == update["receipt_no"]))
        if exists:
            raise HTTPException(status_code=400, detail=f"Duplicate receipt number '{update['receipt_no']}' already exists.")
            
    previous_customer_id = transaction.customer_id
    previous_bank_id = transaction.bank_account_id
    
    if "customer_name" in update or "customer_id" in update:
        customer = get_or_create_customer(db, schemas.TransactionBase(**{**transaction_to_dict(transaction), **update}))
        update["customer_id"] = customer.id
        update.pop("customer_name", None)
        
    for key, value in update.items():
        setattr(transaction, key, value)
        
    # Auto-increment setting count if it matches the prefix (legacy format only)
    settings = db.scalar(select(models.Settings).limit(1))
    if settings:
        prefix = settings.receipt_prefix or "TX"
        # Legacy format: PREFIX-0001 (two parts). Skip currency format: PREFIX-CURR-0001 (three parts)
        parts = transaction.receipt_no.split("-")
        if len(parts) == 2 and transaction.receipt_no.startswith(f"{prefix}-"):
            try:
                num_part = int(parts[-1])
                if num_part >= settings.next_receipt_number:
                    settings.next_receipt_number = num_part + 1
            except ValueError:
                pass
                
    recalculate_after_transaction(db, transaction, previous_customer_id, previous_bank_id)
    log_api_action(request, db, user.id, "update", "transactions", transaction.id, f"Updated transaction {transaction.receipt_no}")
    db.commit()
    db.refresh(transaction)
    return transaction_to_dict(transaction)


@router.delete("/transactions/all/archive")
def delete_all_transactions(
    request: Request,
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    try:
        db.execute(delete(models.Attachment))
        db.execute(delete(models.CustomerLedger))
        db.execute(delete(models.BankLedger))
        db.execute(delete(models.Transaction))
        
        customers = db.query(models.Customer).all()
        for c in customers:
            recalculate_customer_ledger(db, c.id)
            
        banks = db.query(models.BankAccount).all()
        for b in banks:
            recalculate_bank_ledger(db, b.id)
            
        log_api_action(request, db, user.id, "delete", "transactions", 0, "Deleted all transactions and reset ledgers")
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete all transactions: {exc}") from exc

    return {"ok": True, "message": "All transactions have been deleted and ledgers reset."}


@router.delete("/transactions/{transaction_id}")
def delete_transaction(
    request: Request,
    transaction_id: int, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    previous_customer_id = transaction.customer_id
    previous_bank_id = transaction.bank_account_id
    receipt_no = transaction.receipt_no

    try:
        db.execute(delete(models.Attachment).where(models.Attachment.transaction_id == transaction_id))
        db.execute(delete(models.CustomerLedger).where(models.CustomerLedger.transaction_id == transaction_id))
        db.execute(delete(models.BankLedger).where(models.BankLedger.transaction_id == transaction_id))
        db.delete(transaction)
        db.flush()

        if previous_customer_id:
            recalculate_customer_ledger(db, previous_customer_id)
        if previous_bank_id:
            recalculate_bank_ledger(db, previous_bank_id)
        log_api_action(request, db, user.id, "delete", "transactions", transaction_id, f"Deleted transaction {receipt_no}")
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction deletion failed: {exc}") from exc

    return {
        "ok": True,
        "message": "Transaction deleted permanently.",
        "transaction_id": transaction_id,
        "receipt_no": receipt_no,
    }



@router.post("/transactions/{transaction_id}/upload", response_model=schemas.AttachmentRead)
def upload_transaction_file(transaction_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin", "Accountant"))):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    token = get_blob_token()
    if token:
        import urllib.parse
        import urllib.request
        try:
            unique_filename = safe_upload_name(file.filename, f"transaction-{transaction_id}")
            safe_name = urllib.parse.quote(unique_filename)
            url = f"https://blob.vercel-storage.com/{safe_name}"

            headers = {
                "Authorization": f"Bearer {token}",
                "x-api-version": "1",
            }

            file.file.seek(0)
            file_data = file.file.read()

            req = urllib.request.Request(url, data=file_data, headers=headers, method="PUT")
            with urllib.request.urlopen(req) as response:
                if response.status in (200, 201):
                    res_body = response.read().decode("utf-8")
                    blob_url = json.loads(res_body).get("url")
                    attachment = models.Attachment(transaction_id=transaction.id, file_name=file.filename, file_path=blob_url, file_type=file.content_type)
                    transaction.attachment_path = blob_url
                    db.add(attachment)
                    log_action(db, user.id, "upload", "attachments", transaction.id, f"Uploaded attachment {file.filename} to Vercel Blob")
                    db.commit()
                    db.refresh(attachment)
                    return attachment
                else:
                    print(f"Vercel Blob failed with status {response.status}")
        except Exception as e:
            print(f"Vercel Blob upload exception: {e}")

    # Fallback to local file storage when the Blob write token is unavailable.
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / safe_upload_name(file.filename, f"transaction-{transaction_id}")
    file.file.seek(0)
    with path.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    attachment = models.Attachment(transaction_id=transaction.id, file_name=file.filename, file_path=str(path), file_type=file.content_type)
    transaction.attachment_path = str(path)
    db.add(attachment)
    log_action(db, user.id, "upload", "attachments", transaction.id, f"Uploaded attachment {file.filename}")
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/transactions/{transaction_id}/print", response_class=HTMLResponse)
def print_transaction(transaction_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    settings = db.scalar(select(models.Settings).limit(1))
    customer = transaction.customer.name if transaction.customer else "-"
    return f"<html><body><h1>{settings.company_name if settings else 'Sky Banking'}</h1><h2>{transaction.receipt_no}</h2><p>{customer}</p><p>{transaction.amount:,.2f} {transaction.currency}</p></body></html>"


@router.get("/transactions/{transaction_id}/pdf")
def download_transaction_pdf(transaction_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    settings = db.scalar(select(models.Settings).limit(1))
    return Response(transaction_pdf(transaction, settings), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{transaction.receipt_no}.pdf"'})


def _attach_receipt_numbers(db: Session, rows: list):
    """Attach the real transaction receipt_no (e.g. SKY-TX-0007) onto ledger rows,
    which only store the internal transaction_id foreign key by default."""
    transaction_ids = {row.transaction_id for row in rows if row.transaction_id}
    receipts: dict[int, str] = {}
    if transaction_ids:
        receipts = dict(
            db.execute(
                select(models.Transaction.id, models.Transaction.receipt_no).where(
                    models.Transaction.id.in_(transaction_ids)
                )
            ).all()
        )
    for row in rows:
        row.receipt_no = receipts.get(row.transaction_id)
    return rows


@router.get("/ledger/customer/{customer_id}", response_model=list[schemas.LedgerRead])
def customer_ledger(customer_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    rows = db.scalars(select(models.CustomerLedger).where(models.CustomerLedger.customer_id == customer_id).order_by(models.CustomerLedger.date, models.CustomerLedger.id)).all()
    return _attach_receipt_numbers(db, rows)


@router.get("/ledger/bank/{bank_account_id}", response_model=list[schemas.LedgerRead])
def bank_ledger(bank_account_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    rows = db.scalars(select(models.BankLedger).where(models.BankLedger.bank_account_id == bank_account_id).order_by(models.BankLedger.date, models.BankLedger.id)).all()
    return _attach_receipt_numbers(db, rows)


@router.get("/dashboard/summary", response_model=schemas.DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    transactions = db.scalars(select(models.Transaction)).all()
    inflow_types = {"Received", "Import"}
    outflow_types = {"Paid", "Export"}
    received = sum(item.equivalent_amount if item.equivalent_currency == "USD" else item.amount for item in transactions if item.type in inflow_types and item.status != "Cancelled")
    paid = sum(item.equivalent_amount if item.equivalent_currency == "USD" else item.amount for item in transactions if item.type in outflow_types and item.status != "Cancelled")
    currency_totals: dict[str, float] = {}
    for item in transactions:
        if item.status == "Cancelled":
            continue
        value = item.amount if item.type in {"Received", "Import"} else -item.amount
        currency_totals[item.currency] = currency_totals.get(item.currency, 0) + value
    today = date.today()
    month = today.strftime("%Y-%m")
    return {
        "total_received": received,
        "total_paid": paid,
        "total_balance": received - paid,
        "todays_transactions": len([item for item in transactions if item.date == today]),
        "monthly_transactions": len([item for item in transactions if item.date.strftime("%Y-%m") == month]),
        "currency_totals": currency_totals,
    }


@router.get("/dashboard/recent-transactions")
def recent_transactions(limit: int = Query(10, le=50), db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    rows = db.scalars(select(models.Transaction).order_by(models.Transaction.date.desc(), models.Transaction.id.desc()).limit(limit)).all()
    return [transaction_to_dict(item) for item in rows]


@router.get("/dashboard/monthly-chart")
def monthly_chart(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    year_expr = func.extract("year", models.Transaction.date)
    month_expr = func.extract("month", models.Transaction.date)
    rows = db.execute(
        select(year_expr, month_expr, models.Transaction.type, func.sum(models.Transaction.amount))
        .where(models.Transaction.status != "Cancelled")
        .group_by(year_expr, month_expr, models.Transaction.type)
    ).all()
    chart: dict[str, dict[str, float]] = {}
    for year, month_number, tx_type, amount in rows:
        month = f"{int(year):04d}-{int(month_number):02d}"
        chart.setdefault(month, {"received": 0, "paid": 0})
        chart[month]["received" if tx_type in {"Received", "Import"} else "paid"] += float(amount or 0)
    return [{"month": month, **values} for month, values in sorted(chart.items())]


def report_rows(db: Session):
    return [transaction_to_dict(item) for item in db.scalars(select(models.Transaction).order_by(models.Transaction.date.desc())).all()]


@router.get("/reports/daily")
def daily_report(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return [item for item in report_rows(db) if item["date"] == date.today()]


@router.get("/reports/monthly")
def monthly_report(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    month = date.today().strftime("%Y-%m")
    return [item for item in report_rows(db) if item["date"].strftime("%Y-%m") == month]


@router.get("/reports/customer")
def customer_report(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return [{"customer": customer.name, "transactions": len(customer.transactions)} for customer in db.scalars(select(models.Customer)).all()]


@router.get("/reports/bank")
def bank_report(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return db.scalars(select(models.BankAccount)).all()


@router.get("/reports/currency")
def currency_report(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return dashboard_summary(db, _)["currency_totals"]


@router.get("/reports/export/excel")
def export_excel(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    rows = report_rows(db)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()) if rows else ["receipt_no"])
    writer.writeheader()
    writer.writerows(rows)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="transactions.csv"'})


@router.get("/reports/export/pdf")
def export_pdf(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    content = "BT /F2 18 Tf 0.06 0.14 0.25 rg 48 780 Td (Sky Banking Transaction Report) Tj ET"
    for index, row in enumerate(report_rows(db)[:20]):
        y = 740 - index * 24
        content += f"\nBT /F1 9 Tf 0.06 0.14 0.25 rg 48 {y} Td ({pdf_text(row['receipt_no'])} - {pdf_text(row['customer_name'])} - {pdf_text(row['amount'])} {pdf_text(row['currency'])}) Tj ET"
    return Response(make_pdf(content), media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="transactions-report.pdf"'})


@router.get("/settings", response_model=schemas.SettingsRead)
def get_settings(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return db.scalar(select(models.Settings).limit(1))


# Currency code mapping for receipt sequences
CURRENCY_CODES = {
    "USD": "USD",
    "Toman": "TMN",
    "Dirham": "DRM",
    "Afghani": "AFN",
}


@router.get("/settings/next-receipt-no")
def get_next_receipt_no(
    currency: str | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    settings = db.scalar(select(models.Settings).limit(1))
    prefix = (settings.receipt_prefix or "TX") if settings else "TX"

    # If a currency is provided, use a per-currency sequence: PREFIX-CURR-0001
    if currency:
        curr_code = CURRENCY_CODES.get(currency, currency[:3].upper())
        pattern_prefix = f"{prefix}-{curr_code}-"
        existing = db.execute(
            select(models.Transaction.receipt_no)
            .where(models.Transaction.receipt_no.like(f"{pattern_prefix}%"))
        ).scalars().all()
        max_num = 0
        for rn in existing:
            try:
                num_part = int(rn.split("-")[-1])
                if num_part > max_num:
                    max_num = num_part
            except (ValueError, IndexError):
                continue
        num = max_num + 1
        while True:
            receipt_no = f"{pattern_prefix}{num:04d}"
            exists = db.scalar(
                select(models.Transaction).where(models.Transaction.receipt_no == receipt_no)
            )
            if not exists:
                break
            num += 1
        return {"receipt_no": receipt_no, "prefix": prefix, "currency": currency, "next_number": num}

    # Fallback: legacy global sequence
    num = settings.next_receipt_number or 1 if settings else 1
    while True:
        receipt_no = f"{prefix}-{num:04d}"
        exists = db.scalar(select(models.Transaction).where(models.Transaction.receipt_no == receipt_no))
        if not exists:
            break
        num += 1
    return {"receipt_no": receipt_no, "prefix": prefix, "next_number": num}



@router.put("/settings", response_model=schemas.SettingsRead)
def update_settings(
    request: Request,
    payload: schemas.SettingsUpdate, 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    settings = db.scalar(select(models.Settings).limit(1))
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    log_api_action(request, db, user.id, "update", "settings", settings.id, "Updated company settings")
    db.commit()
    db.refresh(settings)
    return settings


@router.post("/settings/logo", response_model=schemas.SettingsRead)
def upload_logo(
    request: Request,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / safe_upload_name(file.filename, "logo")
    with path.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    settings = db.scalar(select(models.Settings).limit(1))
    settings.logo_path = str(path)
    log_api_action(request, db, user.id, "upload", "settings", settings.id, f"Uploaded logo {file.filename}")
    db.commit()
    db.refresh(settings)
    return settings




@router.get("/transactions/{transaction_id}/attachment")
def get_transaction_attachment(
    transaction_id: int, 
    db: Session = Depends(get_db), 
    _: models.User = Depends(get_current_user)
):
    transaction = db.get(models.Transaction, transaction_id)
    if not transaction or not transaction.attachment_path:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if transaction.attachment_path.startswith(("http://", "https://")):
        return RedirectResponse(url=transaction.attachment_path)
        
    path = Path(transaction.attachment_path)
    if not path.exists():
        # Fallback search inside UPLOAD_DIR for matching filename
        filename = path.name
        fallback_path = UPLOAD_DIR / filename
        if fallback_path.exists():
            path = fallback_path
        else:
            raise HTTPException(status_code=404, detail="Attachment file not found on disk")
            
    # Detect content type
    media_type = "application/octet-stream"
    ext = path.suffix.lower()
    if ext == ".pdf":
        media_type = "application/pdf"
    elif ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]:
        media_type = f"image/{ext[1:]}"
        if media_type == "image/jpg":
            media_type = "image/jpeg"
            
    return FileResponse(
        str(path), 
        media_type=media_type, 
        headers={"Content-Disposition": f'inline; filename="{path.name}"'}
    )



@router.get("/backup/status")
def get_backup_status(db: Session = Depends(get_db), user: models.User = Depends(require_role("Admin"))):
    db_path = Path("sky_banking.db")
    db_size = 0
    if db_path.exists():
        db_size = db_path.stat().st_size
    else:
        project_root = Path(__file__).resolve().parents[2]
        possible_db = project_root / "sky_banking.db"
        if possible_db.exists():
            db_size = possible_db.stat().st_size
        else:
            possible_db2 = Path(__file__).resolve().parents[1] / "sky_banking.db"
            if possible_db2.exists():
                db_size = possible_db2.stat().st_size

    attachments_size = 0
    if UPLOAD_DIR.exists():
        for root, dirs, files in os.walk(UPLOAD_DIR):
            for file in files:
                fp = Path(root) / file
                if fp.exists():
                    attachments_size += fp.stat().st_size
                    
    settings = db.scalar(select(models.Settings).limit(1))
    last_backup_at = settings.last_backup_at if settings else None
    auto_backup = settings.auto_backup if settings else False
    
    return {
        "db_size_bytes": db_size,
        "attachments_size_bytes": attachments_size,
        "last_backup_at": last_backup_at,
        "auto_backup": auto_backup
    }


@router.get("/backup/export")
def backup_export(
    request: Request,
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    payload = {
        "users": serialize_table(db, models.User),
        "customers": serialize_table(db, models.Customer),
        "bank_accounts": serialize_table(db, models.BankAccount),
        "transactions": serialize_table(db, models.Transaction),
        "customer_ledger": serialize_table(db, models.CustomerLedger),
        "bank_ledger": serialize_table(db, models.BankLedger),
        "attachments": serialize_table(db, models.Attachment),
        "audit_logs": serialize_table(db, models.AuditLog),
        "settings": serialize_table(db, models.Settings),
    }
    
    # Update settings last_backup_at
    settings = db.scalar(select(models.Settings).limit(1))
    if settings:
        settings.last_backup_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        
    log_api_action(request, db, user.id, "export", "backup", None, "Full database JSON backup exported")
    db.commit()
    
    return payload


@router.post("/backup/import")
async def backup_import(
    request: Request,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    try:
        data = json.loads((await file.read()).decode("utf-8"))
    except Exception as parse_err:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file format: {parse_err}")
        
    required_keys = ["users", "customers", "bank_accounts", "transactions", "settings"]
    if not all(k in data for k in required_keys):
        raise HTTPException(status_code=400, detail="Missing required tables in backup JSON file.")
        
    try:
        # Disable foreign keys safely if SQLite
        bind = db.get_bind()
        is_sqlite = bind.dialect.name == "sqlite" if bind else True
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys = OFF;"))

        # Delete existing data in reverse dependency order to avoid Postgres FK violation
        db.execute(models.Attachment.__table__.delete())
        db.execute(models.CustomerLedger.__table__.delete())
        db.execute(models.BankLedger.__table__.delete())
        db.execute(models.AuditLog.__table__.delete())
        db.execute(models.Transaction.__table__.delete())
        db.execute(models.BankAccount.__table__.delete())
        db.execute(models.Customer.__table__.delete())
        db.execute(models.User.__table__.delete())
        db.execute(models.Settings.__table__.delete())
        db.flush()
        
        # Import each table in parent-first dependency order
        if "settings" in data:
            import_table_data(db, models.Settings, data["settings"])
            db.flush()
        if "users" in data:
            import_table_data(db, models.User, data["users"])
            db.flush()
        if "customers" in data:
            import_table_data(db, models.Customer, data["customers"])
            db.flush()
        if "bank_accounts" in data:
            import_table_data(db, models.BankAccount, data["bank_accounts"])
            db.flush()
        if "transactions" in data:
            import_table_data(db, models.Transaction, data["transactions"])
            db.flush()
        if "customer_ledger" in data:
            import_table_data(db, models.CustomerLedger, data["customer_ledger"])
            db.flush()
        if "bank_ledger" in data:
            import_table_data(db, models.BankLedger, data["bank_ledger"])
            db.flush()
        if "attachments" in data:
            import_table_data(db, models.Attachment, data["attachments"])
            db.flush()
        if "audit_logs" in data:
            import_table_data(db, models.AuditLog, data["audit_logs"])
            db.flush()
            
        # Re-enable foreign keys safely if SQLite
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys = ON;"))
        else:
            # Synchronize PostgreSQL sequence counters to max(id)
            for table_name in ("users", "customers", "bank_accounts", "transactions", "customer_ledger", "bank_ledger", "attachments", "audit_logs", "settings"):
                try:
                    db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(max(id), 1), max(id) IS NOT NULL) FROM {table_name};"))
                except Exception as seq_err:
                    print(f"Sequence sync notice for {table_name}: {seq_err}")
        db.commit()

        # Recalculate customer ledgers and bank ledgers if ledger entries weren't supplied
        if "customer_ledger" not in data:
            for cust in db.scalars(select(models.Customer)).all():
                recalculate_customer_ledger(db, cust.id)
        if "bank_ledger" not in data:
            for bank in db.scalars(select(models.BankAccount)).all():
                recalculate_bank_ledger(db, bank.id)
        db.commit()
        
        # Log audit action
        try:
            log_api_action(request, db, user.id, "import", "backup", None, "Full database backup restored successfully")
            db.commit()
        except Exception as log_err:
            print(f"Audit log notice after restore: {log_err}")
            db.rollback()
        
        return {"ok": True, "message": "Database backup restored successfully."}
        
    except Exception as err:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database restore failed: {err}")


@router.get("/backup/export-attachments")
def backup_export_attachments(
    request: Request,
    db: Session = Depends(get_db), 
    user: models.User = Depends(require_role("Admin"))
):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(UPLOAD_DIR):
            if "temp" in Path(root).parts:
                continue
            for file in files:
                file_path = Path(root) / file
                relative_path = file_path.relative_to(UPLOAD_DIR)
                zip_file.write(str(file_path), str(relative_path))
                
    zip_buffer.seek(0)
    
    # Update settings last_backup_at
    settings = db.scalar(select(models.Settings).limit(1))
    if settings:
        settings.last_backup_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
        
    log_api_action(request, db, user.id, "export", "attachments", None, "Attachments archive exported as ZIP")
    db.commit()
    
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": "attachment; filename=sky-banking-attachments.zip"}
    )


@router.post("/backup/import-attachments")
async def backup_import_attachments(
    request: Request,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Admin"))
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported for attachments restore.")
        
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    zip_bytes = await file.read()
    zip_buffer = io.BytesIO(zip_bytes)
    
    count = 0
    with zipfile.ZipFile(zip_buffer, "r") as zip_file:
        for name in zip_file.namelist():
            if name.startswith("/") or ".." in name:
                continue
            zip_file.extract(name, path=UPLOAD_DIR)
            count += 1
            
    log_api_action(request, db, user.id, "import", "attachments", None, f"Restored {count} attachment files from ZIP")
    db.commit()
    
    return {"ok": True, "extracted_count": count}



@router.get("/audit-logs", response_model=list[schemas.AuditLogRead])
def audit_logs(db: Session = Depends(get_db), _: models.User = Depends(require_role("Admin"))):
    rows = db.execute(
        select(models.AuditLog, models.User.email)
        .outerjoin(models.User, models.AuditLog.user_id == models.User.id)
        .order_by(models.AuditLog.created_at.desc())
    ).all()
    results = []
    for log, email in rows:
        log_dict = {}
        for col in log.__table__.columns:
            val = getattr(log, col.name)
            log_dict[col.name] = val
        log_dict["user_email"] = email
        results.append(log_dict)
    return results
