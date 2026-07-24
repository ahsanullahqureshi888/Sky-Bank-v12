import tempfile
import unittest
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.app import models
from backend.app.auth.security import create_access_token, hash_password
from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.services.seed import seed_database


class CustomerUpdateTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        db_path = Path(self.tempdir.name) / "customer-update.db"
        self.engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        self.TestingSessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(bind=self.engine)

        def override_get_db():
            db = self.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        with self.TestingSessionLocal() as db:
            admin = models.User(
                name="Customer Admin",
                email="customer-admin@example.com",
                password_hash=hash_password("admin123"),
                role="Admin",
            )
            accountant = models.User(
                name="Customer Accountant",
                email="customer-accountant@example.com",
                password_hash=hash_password("accountant123"),
                role="Accountant",
            )
            customer = models.Customer(
                name="Persistent Customer",
                phone="+93 700 100 100",
                address="Kabul",
                notes="Original notes",
                currency="USD",
                opening_balance=100,
            )
            db.add_all([admin, accountant, customer])
            db.flush()
            transaction = models.Transaction(
                receipt_no="CUSTOMER-UPDATE-KEEP",
                date=date.today(),
                type="Received",
                customer_id=customer.id,
                subject="Existing receipt must remain",
                amount=250,
                currency="USD",
                equivalent_amount=250,
                equivalent_currency="USD",
                payment_method="Cash",
                status="Completed",
                created_by=admin.id,
            )
            db.add(transaction)
            db.commit()
            self.admin_id = admin.id
            self.accountant_id = accountant.id
            self.customer_id = customer.id
            self.transaction_id = transaction.id

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()
        self.tempdir.cleanup()

    def headers_for(self, user_id, role):
        token = create_access_token(str(user_id), role)
        return {"Authorization": f"Bearer {token}"}

    def test_update_persists_all_fields_and_keeps_same_record(self):
        payload = {
            "name": "Persistent Customer Updated",
            "phone": "+93 799 222 333",
            "address": "Herat",
            "notes": "Updated account notes",
            "currency": "Afghani",
            "opening_balance": 4250.5,
        }
        response = self.client.put(
            f"/api/customers/{self.customer_id}",
            json=payload,
            headers=self.headers_for(self.admin_id, "Admin"),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], self.customer_id)
        self.assertEqual(response.json()["name"], payload["name"])

        with self.TestingSessionLocal() as reopened_db:
            persisted = reopened_db.get(models.Customer, self.customer_id)
            self.assertEqual(persisted.name, payload["name"])
            self.assertEqual(persisted.phone, payload["phone"])
            self.assertEqual(persisted.address, payload["address"])
            self.assertEqual(persisted.notes, payload["notes"])
            self.assertEqual(persisted.currency, payload["currency"])
            self.assertEqual(persisted.opening_balance, payload["opening_balance"])
            self.assertEqual(reopened_db.scalar(select(models.Customer).where(models.Customer.id == self.customer_id)), persisted)
            self.assertEqual(len(reopened_db.scalars(select(models.Customer)).all()), 1)
            transaction = reopened_db.get(models.Transaction, self.transaction_id)
            self.assertIsNotNone(transaction)
            self.assertEqual(transaction.receipt_no, "CUSTOMER-UPDATE-KEEP")
            self.assertEqual(transaction.customer_id, self.customer_id)

    def test_accountant_can_update_customer(self):
        response = self.client.put(
            f"/api/customers/{self.customer_id}",
            json={"phone": "+93 788 000 111"},
            headers=self.headers_for(self.accountant_id, "Accountant"),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["phone"], "+93 788 000 111")

    def test_commit_failure_rolls_back_and_returns_error(self):
        def failing_get_db():
            db = self.TestingSessionLocal()
            original_commit = db.commit

            def fail_commit():
                raise RuntimeError("forced customer commit failure")

            db.commit = fail_commit
            try:
                yield db
            finally:
                db.commit = original_commit
                db.close()

        app.dependency_overrides[get_db] = failing_get_db
        response = self.client.put(
            f"/api/customers/{self.customer_id}",
            json={"name": "Must Not Persist"},
            headers=self.headers_for(self.admin_id, "Admin"),
        )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Customer update failed. No changes were saved.")
        with self.TestingSessionLocal() as db:
            self.assertEqual(db.get(models.Customer, self.customer_id).name, "Persistent Customer")

    def test_restart_seed_does_not_recreate_customer_after_rename(self):
        response = self.client.put(
            f"/api/customers/{self.customer_id}",
            json={"name": "Renamed After Save"},
            headers=self.headers_for(self.admin_id, "Admin"),
        )
        self.assertEqual(response.status_code, 200)

        with self.TestingSessionLocal() as db:
            seed_database(db)
            customers = db.scalars(select(models.Customer).order_by(models.Customer.id)).all()
            self.assertEqual(len(customers), 1)
            self.assertEqual(customers[0].id, self.customer_id)
            self.assertEqual(customers[0].name, "Renamed After Save")
            self.assertIsNone(db.scalar(select(models.Customer).where(models.Customer.name == "Ariana Balam Baran")))


if __name__ == "__main__":
    unittest.main()
