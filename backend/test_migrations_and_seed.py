import unittest

from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User
from app.services.migrations import run_migrations
from app.services.seed import seed_database
from app.auth.security import verify_password


class MigrationAndSeedTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        run_migrations(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def test_username_column_is_available_and_migration_is_repeatable(self):
        run_migrations(self.engine)
        columns = {column["name"] for column in inspect(self.engine).get_columns("users")}
        self.assertIn("username", columns)

    def test_default_account_is_created_once_with_hashed_password(self):
        with self.Session() as db:
            seed_database(db)
            seed_database(db)
            users = db.scalars(select(User).where(User.email == "ahsan@sky.com")).all()
            self.assertEqual(len(users), 1)
            self.assertEqual(users[0].username, "ahsan")
            self.assertTrue(verify_password("Qur78Ahs@@", users[0].password_hash))


if __name__ == "__main__":
    unittest.main()
