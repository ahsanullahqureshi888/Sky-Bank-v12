import os
import sys
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(__file__))

from app import models
from app.database import SessionLocal
from app.services.ledger import recalculate_bank_ledger

def check_banks():
    db = SessionLocal()
    try:
        banks = db.scalars(select(models.BankAccount)).all()
        print("=== BANK ACCOUNTS IN DATABASE ===")
        for b in banks:
            tx_count = len(db.scalars(select(models.Transaction).where(models.Transaction.bank_account_id == b.id)).all())
            ledger_count = len(db.scalars(select(models.BankLedger).where(models.BankLedger.bank_account_id == b.id)).all())
            print(f"ID: {b.id} | Name: '{b.bank_name}' | Account: '{b.account_name}' | Currency: {b.currency} | Opening: {b.opening_balance:,.0f} | Current: {b.current_balance:,.0f} | TXs: {tx_count} | Ledger Rows: {ledger_count}")
            
            # Trigger recalculation to be 100% sure
            recalculate_bank_ledger(db, b.id)
        
        db.commit()
        print("\n=== RECALCULATED ALL BANK LEDGERS CLEANLY ===")
        
        for b in banks:
            db.refresh(b)
            ledger_count = len(db.scalars(select(models.BankLedger).where(models.BankLedger.bank_account_id == b.id)).all())
            print(f"ID: {b.id} | Name: '{b.bank_name}' | Account: '{b.account_name}' | Current Balance: {b.current_balance:,.0f} {b.currency} | Ledger Rows: {ledger_count}")

    finally:
        db.close()

if __name__ == "__main__":
    check_banks()
