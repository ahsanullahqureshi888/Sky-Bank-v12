import os
import sys
from datetime import date
from sqlalchemy import select

# Ensure backend modules can be imported
sys.path.insert(0, os.path.dirname(__file__))

from app import models
from app.database import SessionLocal
from app.services.ledger import recalculate_after_transaction

def add_toman_transactions():
    db = SessionLocal()
    try:
        # 1. Find or create Customer "Mrs Khanam Tokali Bolambar"
        customer = db.scalar(
            select(models.Customer).where(
                (models.Customer.name.ilike("%Khanam Tokali%")) |
                (models.Customer.name.ilike("%Bolambar%"))
            )
        )
        if not customer:
            customer = models.Customer(
                name="Mrs Khanam Tokali Bolambar",
                phone="+93 700 888 999",
                address="Kabul / Dubai",
                notes="Balam Bar Baran Toman Account (@yacmntajik)",
                entity_type="sarafi"
            )
            db.add(customer)
            db.flush()
            print(f"[CREATED] New Customer: {customer.name} (ID: {customer.id})")
        else:
            print(f"[FOUND] Customer: {customer.name} (ID: {customer.id})")

        # 2. Find or create Bank Account for "MILAT BANK"
        bank_account = db.scalar(
            select(models.BankAccount).where(models.BankAccount.bank_name.ilike("%MILAT%"))
        )
        if not bank_account:
            bank_account = models.BankAccount(
                bank_name="MILAT BANK",
                account_name="Hashempour Account",
                account_number="1222222-ASAS",
                currency="Toman",
                opening_balance=0,
                current_balance=0
            )
            db.add(bank_account)
            db.flush()
            print(f"[CREATED] Bank Account: {bank_account.bank_name} - {bank_account.account_number}")
        else:
            print(f"[FOUND] Bank Account: {bank_account.bank_name} (ID: {bank_account.id})")

        # 3. Find Admin User ID
        admin = db.scalar(select(models.User).where(models.User.email == "admin@brb.com"))
        admin_id = admin.id if admin else 1

        tx_records = [
            {
                "receipt_no": "TX-TMN-0001",
                "date": date(2026, 8, 11),  # ۲۰/۵/۱۴۰۵ Solar Hijri = 11 Aug 2026
                "type": "Received",
                "customer_id": customer.id,
                "company_name": "Balam Bar Baran - TOMAN",
                "subject": "به حساب هاشم پور توسط امید احسان صرافی",
                "amount": 1825000000.0,
                "currency": "Toman",
                "equivalent_amount": 30416.67,
                "equivalent_currency": "USD",
                "payment_method": "Hawala",
                "bank_account_id": bank_account.id,
                "receiver_name": "امید احسان صرافی / هاشم پور",
                "description": "MILAT BANK · 1222222-ASAS - نقد برایت جمع میشه به حساب هاشم پور توسط امید احسان صرافی - 1,825,000,000 تومان @Mrs Khanam Tokali Bolambar (۲۰/۵/۱۴۰۵)",
                "status": "Completed",
                "created_by": admin_id,
            },
            {
                "receipt_no": "TX-TMN-0002",
                "date": date(2026, 8, 2),  # ۱۱/۵/۱۴۰۵ Solar Hijri = 02 Aug 2026
                "type": "Received",
                "customer_id": customer.id,
                "company_name": "Balam Bar Baran - TOMAN",
                "subject": "توسط نوی تیمور شاهی صرافی به حساب بلم بار باران",
                "amount": 1850000000.0,
                "currency": "Toman",
                "equivalent_amount": 30833.33,
                "equivalent_currency": "USD",
                "payment_method": "Hawala",
                "bank_account_id": bank_account.id,
                "receiver_name": "نوی تیمور شاهی صرافی / بلم بار باران",
                "description": "نقد برایت جمع میشه توسط نوی تیمور شاهی صرافی به حساب بلم بار باران - 1,850,000,000 تومان @yacmntajik (۱۱/۵/۱۴۰۵)",
                "status": "Completed",
                "created_by": admin_id,
            }
        ]

        added_txs = []
        for tx_data in tx_records:
            existing = db.scalar(select(models.Transaction).where(models.Transaction.receipt_no == tx_data["receipt_no"]))
            if not existing:
                tx = models.Transaction(**tx_data)
                db.add(tx)
                db.flush()
                recalculate_after_transaction(db, tx)
                added_txs.append(tx)
                print(f"[SUCCESS] Added Transaction: {tx.receipt_no} | {tx.amount:,.0f} {tx.currency} for {customer.name}")
            else:
                print(f"[EXISTS] Transaction {tx_data['receipt_no']} already present.")

        db.commit()
        print(f"[FINISHED] Successfully committed {len(added_txs)} Toman transactions to Sky Bank v12 database.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to add transactions: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    add_toman_transactions()
