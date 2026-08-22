from datetime import date, datetime
import os

from sqlalchemy import select
from sqlalchemy.orm import Session
from .. import models
from ..auth.security import hash_password, verify_password
from .ledger import log_action, recalculate_customer_ledger, recalculate_bank_ledger, recalculate_after_transaction


def seed_database(db: Session) -> None:
    # 1. Seed Operational & Administrator Accounts
    admin = db.scalar(select(models.User).where(models.User.email == "admin@brb.com"))
    if not admin:
        admin = models.User(
            name="Balam Bar Baran Admin",
            username="admin",
            email="admin@brb.com",
            password_hash=hash_password("admin123"),
            role="Admin",
            is_active=True,
        )
        db.add(admin)
        db.flush()
    else:
        # Ensure password hash is valid
        if not verify_password("admin123", admin.password_hash):
            admin.password_hash = hash_password("admin123")
            db.flush()

    default_user = db.scalar(select(models.User).where(models.User.email == "ahsan@sky.com"))
    if not default_user:
        default_user = models.User(
            name="Ahsan",
            username="ahsan",
            email="ahsan@sky.com",
            password_hash=hash_password("Qur78Ahs@@"),
            role="Admin",
            is_active=True,
        )
        db.add(default_user)
        db.flush()
    else:
        if not default_user.username:
            default_user.username = "ahsan"
        if not verify_password("Qur78Ahs@@", default_user.password_hash):
            default_user.password_hash = hash_password("Qur78Ahs@@")
        db.flush()

    accountant = db.scalar(select(models.User).where(models.User.email == "accountant@skybanking.local"))
    if not accountant:
        accountant = models.User(
            name="General Accountant",
            username="accountant",
            email="accountant@skybanking.local",
            password_hash=hash_password("1234"),
            role="Accountant",
            is_active=True,
        )
        db.add(accountant)
        db.flush()
    else:
        if not verify_password("1234", accountant.password_hash):
            accountant.password_hash = hash_password("1234")
            db.flush()

    balam_user = db.scalar(select(models.User).where(models.User.email == "balam@sky.com"))
    if not balam_user:
        balam_user = models.User(
            name="Balam Bar Baran",
            username="balam",
            email="balam@sky.com",
            password_hash=hash_password("1234"),
            role="Accountant",
            is_active=True,
        )
        db.add(balam_user)
        db.flush()
    else:
        if not verify_password("1234", balam_user.password_hash):
            balam_user.password_hash = hash_password("1234")
            db.flush()

    # 2. Check and load comprehensive dataset from initial JSON if available
    import json
    from pathlib import Path
    
    json_candidates = [
        Path(__file__).resolve().parents[2] / "data" / "sky_banking_initial_data.json",
        Path(__file__).resolve().parents[3] / "sky_banking_initial_data.json",
        Path("/tmp/sky_banking_initial_data.json"),
    ]
    
    loaded_from_json = False
    for json_path in json_candidates:
        if json_path.exists():
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    initial_data = json.load(f)
                
                # Seed Settings
                if initial_data.get("settings"):
                    s_data = initial_data["settings"][0]
                    curr_settings = db.scalar(select(models.Settings))
                    if not curr_settings:
                        curr_settings = models.Settings()
                        db.add(curr_settings)
                        db.flush()
                    for k, v in s_data.items():
                        if hasattr(curr_settings, k) and k != "id":
                            setattr(curr_settings, k, v)
                    db.flush()
                
                # Seed Bank Accounts
                for b_data in initial_data.get("bank_accounts", []):
                    acc_num = b_data.get("account_number")
                    if not db.scalar(select(models.BankAccount).where(models.BankAccount.account_number == acc_num)):
                        bank_acc = models.BankAccount(
                            bank_name=b_data.get("bank_name"),
                            account_name=b_data.get("account_name"),
                            account_number=acc_num,
                            currency=b_data.get("currency", "USD"),
                            opening_balance=float(b_data.get("opening_balance", 0)),
                            current_balance=float(b_data.get("current_balance", 0)),
                        )
                        db.add(bank_acc)
                db.flush()

                # Seed Customers
                for c_data in initial_data.get("customers", []):
                    c_name = c_data.get("name")
                    if not db.scalar(select(models.Customer).where(models.Customer.name == c_name)):
                        cust = models.Customer(
                            name=c_name,
                            phone=c_data.get("phone"),
                            address=c_data.get("address"),
                            notes=c_data.get("notes"),
                            entity_type=c_data.get("entity_type", "customer"),
                        )
                        db.add(cust)
                db.flush()

                # Seed Transactions (ensure all historical transactions exist)
                all_custs = db.scalars(select(models.Customer)).all()
                cust_map = {c.name.strip().lower(): c.id for c in all_custs if c.name}
                default_cust_id = all_custs[0].id if all_custs else None

                all_banks = db.scalars(select(models.BankAccount)).all()
                bank_ids = {b.id for b in all_banks}

                for t_data in initial_data.get("transactions", []):
                    rec_no = t_data.get("receipt_no")
                    if not db.scalar(select(models.Transaction.id).where(models.Transaction.receipt_no == rec_no)):
                        try:
                            t_date = t_data.get("date")
                            if isinstance(t_date, str):
                                t_date = datetime.strptime(t_date[:10], "%Y-%m-%d").date()

                            comp = (t_data.get("company_name") or "").strip()
                            cust_id = cust_map.get(comp.lower()) or t_data.get("customer_id")
                            if cust_id not in [c.id for c in all_custs]:
                                cust_id = default_cust_id

                            b_id = t_data.get("bank_account_id")
                            if b_id not in bank_ids:
                                b_id = None

                            tx = models.Transaction(
                                receipt_no=rec_no,
                                date=t_date,
                                type=t_data.get("type", "Credit"),
                                customer_id=cust_id,
                                company_name=comp or (all_custs[0].name if all_custs else "General"),
                                subject=t_data.get("subject", ""),
                                amount=float(t_data.get("amount", 0)),
                                currency=t_data.get("currency", "USD"),
                                equivalent_amount=float(t_data.get("equivalent_amount", 0)),
                                equivalent_currency=t_data.get("equivalent_currency", "USD"),
                                payment_method=t_data.get("payment_method", "Cash"),
                                bank_account_id=b_id,
                                receiver_name=t_data.get("receiver_name"),
                                description=t_data.get("description"),
                                status=t_data.get("status", "Completed"),
                                created_by=admin.id,
                                created_at=datetime.utcnow(),
                                updated_at=datetime.utcnow()
                            )
                            db.add(tx)
                            db.flush()
                        except Exception as tx_err:
                            print(f"Notice inserting tx {rec_no}: {tx_err}")
                db.flush()

                # Recalculate Ledgers
                for cust in db.scalars(select(models.Customer)).all():
                    recalculate_customer_ledger(db, cust.id)
                for b_acc in db.scalars(select(models.BankAccount)).all():
                    recalculate_bank_ledger(db, b_acc.id)

                db.commit()
                loaded_from_json = True
                print(f"Loaded initial dataset from {json_path}")
                break
            except Exception as ex:
                print(f"Notice loading initial dataset from {json_path}: {ex}")

    if not loaded_from_json:
        # Fallback to standard seed settings if JSON is unavailable
        settings = db.scalar(select(models.Settings))
        if not settings:
            settings = models.Settings(
                company_name="SKY ARIANA GROUP OF COMPANIES",
                logo_path="/logo.png",
                address="Kandahar, Afghanistan",
                phone="+93 700 9393 65, +93 711 4355 29",
                email="transport@skyariana.com",
                receipt_footer="Official receipt generated by SKY ARIANA GROUP OF COMPANIES.2026",
                receipt_prefix="TX",
                next_receipt_number=1,
            )
            db.add(settings)
            db.flush()

    # 7. Audit Logs Seed
    if not db.scalar(select(models.AuditLog).limit(1)):
        audit_records = [
            {"user_id": admin.id, "action": "update", "table_name": "users", "record_id": 1, "description": "Changed password for admin@brb.com", "created_at": datetime(2026, 7, 13, 5, 48, 3)},
            {"user_id": admin.id, "action": "delete", "table_name": "customers", "record_id": 1, "description": "Deleted customer شیر احمد", "ip_address": "104.234.53.181", "device_info": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36", "created_at": datetime(2026, 7, 13, 14, 10, 34)},
            {"user_id": admin.id, "action": "update", "table_name": "customers", "record_id": 2, "description": "Updated customer BALAM BAR BARAN", "ip_address": "104.234.53.168", "device_info": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36", "created_at": datetime(2026, 7, 13, 15, 27, 0)},
            {"user_id": admin.id, "action": "create", "table_name": "users", "record_id": 3, "description": "Created user balam@sky.com", "created_at": datetime(2026, 7, 14, 20, 35, 45)},
            {"user_id": admin.id, "action": "create", "table_name": "transactions", "record_id": 2, "description": "Added transaction SKY-TX-01", "ip_address": "45.146.54.168", "device_info": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0.0.0 Safari/537.36", "created_at": datetime(2026, 7, 23, 12, 6, 51)},
            {"user_id": admin.id, "action": "update", "table_name": "bank_accounts", "record_id": 1, "description": "Updated bank account SKY-0012-8890-USD", "ip_address": "45.8.19.144", "device_info": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0.0.0 Safari/537.36", "created_at": datetime(2026, 7, 23, 13, 58, 28)},
            {"user_id": admin.id, "action": "export", "table_name": "backup", "description": "Full database JSON backup exported", "ip_address": "45.8.19.146", "device_info": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0.0.0 Safari/537.36", "created_at": datetime(2026, 7, 23, 14, 30, 8)},
            {"user_id": admin.id, "action": "create", "table_name": "transactions", "record_id": 4, "description": "Added transaction SKY-TX-002", "ip_address": "10.29.161.129", "device_info": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0.0.0 Safari/537.36", "created_at": datetime(2026, 7, 25, 10, 42, 20)},
        ]
        for a_data in audit_records:
            log = models.AuditLog(**a_data)
            db.add(log)

    db.commit()
