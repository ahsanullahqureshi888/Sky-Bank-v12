import os
import sys
from datetime import date
from sqlalchemy import select

# Ensure backend modules can be imported
sys.path.insert(0, os.path.dirname(__file__))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app import models
from app.database import SessionLocal
from app.services.ledger import recalculate_after_transaction

def parse_shamsi_to_gregorian(shamsi_str: str) -> date:
    """
    Converts 1405 Solar Hijri dates to 2026 Gregorian dates.
    Format: YYYY/MM/DD or YYYY-MM-DD
    1405 SH -> 2026 AD
    """
    parts = shamsi_str.replace("-", "/").split("/")
    if len(parts) != 3:
        return date(2026, 8, 1)
    
    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    
    # 1405 SH month mapping to 2026 AD:
    # Month 1 (Hamal/Farvardin): Mar 21 - Apr 19 -> 2026-03 / 2026-04
    # Month 2 (Sowr/Ordibehesht): Apr 20 - May 20 -> 2026-04 / 2026-05
    # Month 3 (Jawza/Khordad): May 21 - Jun 21 -> 2026-05 / 2026-06
    # Month 4 (Saratan/Tir): Jun 22 - Jul 22 -> 2026-06 / 2026-07
    # Month 5 (Asad/Mordad): Jul 23 - Aug 22 -> 2026-07 / 2026-08
    
    month_offsets = {
        1: (3, 21),
        2: (4, 20),
        3: (5, 21),
        4: (6, 22),
        5: (7, 23),
    }
    
    base_m, base_d = month_offsets.get(m, (7, 23))
    # Approximate Gregorian calculation for 1405 SH
    try:
        from datetime import datetime, timedelta
        # Base date for start of SH month in 2026
        base_date = date(2026, base_m, base_d)
        greg_date = base_date + timedelta(days=d - 1)
        return greg_date
    except Exception:
        return date(2026, 8, 1)

def add_all_green_toman_records():
    db = SessionLocal()
    try:
        # Find or create Customer
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
                notes="Balam Bar Baran Toman Account",
                entity_type="sarafi"
            )
            db.add(customer)
            db.flush()

        # Find or create MILAT BANK Toman Account
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

        admin = db.scalar(select(models.User).where(models.User.email == "admin@brb.com"))
        admin_id = admin.id if admin else 1

        # Complete list of all 33 green Toman credit/inflow transactions from the 2-page document
        raw_green_records = [
            # Page 1 Green Rows (1-26)
            {"sno": 1, "date_sh": "1405/02/16", "amount": 1000000000.0, "account": "صادرات-هادی هاشم پور", "bl": "ESLSHKBND00008/26", "company": "پاک افغان", "container": "کانتینر 1"},
            {"sno": 2, "date_sh": "1405/02/17", "amount": 1646000000.0, "account": "صادرات-هادی هاشم پور", "bl": "MLGNWBND25003135", "company": "عبید کوثر", "container": "کانتینر 10"},
            {"sno": 3, "date_sh": "1405/02/21", "amount": 1000000000.0, "account": "صادرات-نرگس شکری", "bl": "MLGNWBND25003067-1", "company": "عبید کوثر", "container": "کانتینر 14"},
            {"sno": 4, "date_sh": "1405/02/24", "amount": 300000000.0, "account": "صادرات-احمد محمودزایی", "bl": "MLGNWBND25003041", "company": "عبید کوثر", "container": "کانتینر 6"},
            {"sno": 5, "date_sh": "1405/02/27", "amount": 1770000000.0, "account": "صادرات-نرگس شکری", "bl": "SIIXYINC26000211", "company": "ناصرخان", "container": "کانتینر 2"},
            {"sno": 6, "date_sh": "1405/02/30", "amount": 3000000000.0, "account": "صادرات-نرگس شکری", "bl": "IIX1377WUOG2873", "company": "هارون کاکر", "container": "کانتینر 2"},
            {"sno": 7, "date_sh": "1405/03/03", "amount": 500000000.0, "account": "صادرات-زهرا چکرنه گرگیج", "bl": "SISHACNC26007037", "company": "وتندا", "container": "کانتینر 1"},
            {"sno": 8, "date_sh": "1405/03/10", "amount": 8464500000.0, "account": "صادرات-بلم بار باران", "bl": "BLSTPKLKEA0129", "company": "عبید کوثر", "container": "کانتینر 10"},
            {"sno": 9, "date_sh": "1405/03/27", "amount": 1200000000.0, "account": "صرافی-خضری", "bl": "NVSJEABND01439", "company": "هارون کاکر", "container": "کانتینر 4"},
            {"sno": 10, "date_sh": "1405/03/30", "amount": 3599800000.0, "account": "ملت-هادی هاشم پور", "bl": "LCKPM101NAV2600007", "company": "عبید کوثر", "container": "کانتینر 8"},
            {"sno": 11, "date_sh": "1405/03/30", "amount": 500000000.0, "account": "ملت-هادی هاشم پور", "bl": "HDM1671WXRQ5656", "company": "وتندا", "container": "کانتینر 4"},
            {"sno": 12, "date_sh": "1405/03/30", "amount": 900000000.0, "account": "ملت-هادی هاشم پور", "bl": "HDM1678WIRG2242", "company": "محمد ادریس", "container": "کانتینر 1"},
            {"sno": 13, "date_sh": "1405/04/06", "amount": 2675000000.0, "account": "ملت-یاسمن تاجیک", "bl": "APS1237XRQ5405", "company": "پاک افغان", "container": "کانتینر 1"},
            {"sno": 14, "date_sh": "1405/04/08", "amount": 100000000.0, "account": "ملت-هادی هاشم پور", "bl": "APS1237XRQ4987", "company": "وتندانا", "container": "کانتینر 4"},
            {"sno": 15, "date_sh": "1405/04/10", "amount": 500000000.0, "account": "ملت-هادی هاشم پور", "bl": "ZMJEASPE081357", "company": "پاک افغان", "container": "کانتینر 3"},
            {"sno": 16, "date_sh": "1405/04/21", "amount": 1740000000.0, "account": "ملت-هادی هاشم پور", "bl": "JKT554223CAB", "company": "سردار ولی", "container": "کانتینر 5"},
            {"sno": 17, "date_sh": "1405/04/22", "amount": 1000000000.0, "account": "ملت-هادی هاشم پور", "bl": "ISC1194WPSP0366", "company": "سردار ولی", "container": "کانتینر 5"},
            {"sno": 18, "date_sh": "1405/01/06", "amount": 1460000000.0, "account": "صادرات-نرگس شکری", "bl": "SISHACNC26007076", "company": "وتندانا", "container": "کانتینر 1"},
            {"sno": 19, "date_sh": "1405/01/15", "amount": 2500000000.0, "account": "صادرات-نرگس شکری", "bl": "ALSPKGJEA0210", "company": "عبید کوثر", "container": "کانتینر 10"},
            {"sno": 20, "date_sh": "1405/01/15", "amount": 1535000000.0, "account": "صادرات-هادی هاشم پور", "bl": "1434616-1435305", "company": "پاک افغان", "container": "ماشین 3 تایی"},
            {"sno": 21, "date_sh": "1405/01/19", "amount": 10000000000.0, "account": "صادرات-هادی هاشم پور", "bl": "IIX1380WUOG3128", "company": "عظمت کاکر", "container": "کانتینر 4"},
            {"sno": 22, "date_sh": "1405/02/01", "amount": 540000000.0, "account": "صادرات-هادی هاشم پور", "bl": "IIX1380WUOG3118", "company": "عظمت کاکر", "container": "کانتینر 12"},
            {"sno": 23, "date_sh": "1405/02/09", "amount": 2305100000.0, "account": "صادرات-نرگس شکری", "bl": "IIX1380WUOG3082", "company": "عظمت کاکر", "container": "کانتینر 5"},
            {"sno": 24, "date_sh": "1405/02/10", "amount": 2000000000.0, "account": "صادرات-هادی هاشم پور", "bl": "N/A", "company": "میثم مرادی", "container": "N/A"},
            {"sno": 25, "date_sh": "1405/04/24", "amount": 3660000000.0, "account": "ملت-هادی هاشم پور", "bl": "ALS-KHI-JEA-01397SECOMB5261", "company": "عبید کوثر", "container": "کانتینر 30"},
            {"sno": 26, "date_sh": "1405/03/28", "amount": 665000000.0, "account": "ملت-هادی هاشم پور", "bl": "CPI2675/26/1", "company": "پاک افغان", "container": "کانتینر 1"},

            # Page 2 Green Rows (27-33)
            {"sno": 27, "date_sh": "1405/04/28", "amount": 1000000000.0, "account": "شبیر احمد", "bl": "N/A", "company": "دریافت حواله", "container": "شماره واریزی 27"},
            {"sno": 28, "date_sh": "1405/05/04", "amount": 2222700000.0, "account": "شبیر احمد", "bl": "N/A", "company": "دریافت حواله", "container": "شماره واریزی 28"},
            {"sno": 29, "date_sh": "1405/05/11", "amount": 850000000.0, "account": "شبیر احمد", "bl": "N/A", "company": "دریافت حواله", "container": "شماره واریزی 29"},
            {"sno": 30, "date_sh": "1405/05/11", "amount": 1000000000.0, "account": "شبیر احمد", "bl": "N/A", "company": "دریافت حواله", "container": "شماره واریزی 30"},
            {"sno": 31, "date_sh": "1405/05/17", "amount": 320800000.0, "account": "حاجی داود / هاشم پور", "bl": "N/A", "company": "حاجی داود", "container": "حواله"},
            {"sno": 32, "date_sh": "1405/05/19", "amount": 1000000000.0, "account": "امید احسان صرافی / هاشم پور", "bl": "N/A", "company": "امید احسان صرافی", "container": "حواله"},
            {"sno": 33, "date_sh": "1405/05/20", "amount": 1825000000.0, "account": "امید احسان صرافی / هاشم پور", "bl": "N/A", "company": "امید احسان صرافی", "container": "حواله"},
        ]

        added_count = 0
        total_credit_added = 0.0

        for rec in raw_green_records:
            receipt_no = f"TX-TMN-{rec['sno']:04d}"
            greg_date = parse_shamsi_to_gregorian(rec["date_sh"])
            equivalent_usd = round(rec["amount"] / 60000.0, 2)
            
            subject = f"واریزی {rec['account']} - {rec['company']}"
            desc = f"واریزی و دریافت نقد تومان | حساب: {rec['account']} | بارنامه: {rec['bl']} | شرکت: {rec['company']} | کانتینر: {rec['container']} ({rec['date_sh']})"

            existing = db.scalar(select(models.Transaction).where(models.Transaction.receipt_no == receipt_no))
            if not existing:
                tx = models.Transaction(
                    receipt_no=receipt_no,
                    date=greg_date,
                    type="Received",
                    customer_id=customer.id,
                    company_name="Balam Bar Baran - TOMAN",
                    subject=subject,
                    amount=rec["amount"],
                    currency="Toman",
                    equivalent_amount=equivalent_usd,
                    equivalent_currency="USD",
                    payment_method="Hawala" if "حواله" in desc else "Bank Transfer",
                    bank_account_id=bank_account.id,
                    receiver_name=rec["account"],
                    description=desc,
                    status="Completed",
                    created_by=admin_id,
                )
                db.add(tx)
                db.flush()
                recalculate_after_transaction(db, tx)
                added_count += 1
                total_credit_added += rec["amount"]
                print(f"[{rec['sno']}/33] Added {receipt_no}: {rec['amount']:,.0f} Toman ({rec['account']})")
            else:
                # Update bank_account_id if missing
                if not existing.bank_account_id:
                    existing.bank_account_id = bank_account.id
                    db.flush()
                    recalculate_after_transaction(db, existing)

        db.commit()
        print(f"\n=======================================================")
        print(f"SUCCESS: Added/Verified {len(raw_green_records)} Green Toman Inflows!")
        print(f"Total Toman Credit Volume: {total_credit_added:,.0f} Toman")
        print(f"Bank Account '{bank_account.bank_name}' Balance Updated!")
        print(f"=======================================================")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    add_all_green_toman_records()
