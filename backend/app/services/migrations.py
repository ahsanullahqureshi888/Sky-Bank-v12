from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


MIGRATIONS = {
    "users.username": "ALTER TABLE users ADD COLUMN username VARCHAR(80)",
    "settings.receipt_prefix": "ALTER TABLE settings ADD COLUMN receipt_prefix VARCHAR(40) DEFAULT 'TX'",
    "settings.auto_backup": "ALTER TABLE settings ADD COLUMN auto_backup BOOLEAN DEFAULT FALSE",
    "settings.last_backup_at": "ALTER TABLE settings ADD COLUMN last_backup_at VARCHAR(100)",
    "settings.next_receipt_number": "ALTER TABLE settings ADD COLUMN next_receipt_number INTEGER DEFAULT 1",
    "settings.receipt_background": "ALTER TABLE settings ADD COLUMN receipt_background VARCHAR(255) DEFAULT '/afghan-blue-mosque.jpg'",
    "audit_logs.ip_address": "ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(100)",
    "audit_logs.device_info": "ALTER TABLE audit_logs ADD COLUMN device_info VARCHAR(255)",
    "customers.entity_type": "ALTER TABLE customers ADD COLUMN entity_type VARCHAR(40) DEFAULT 'customer'",
}


def run_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    is_postgres = "postgresql" in str(engine.url)
    with engine.begin() as conn:
        for key, sql in MIGRATIONS.items():
            table_name, column_name = key.split(".")
            if not inspector.has_table(table_name):
                continue
            columns = [col["name"] for col in inspector.get_columns(table_name)]
            if column_name not in columns:
                try:
                    conn.execute(text(sql))
                except Exception as e:
                    print(f"Migration notice for {key}: {e}")

        inspector = inspect(conn)
        if inspector.has_table("users"):
            indexes = {index["name"] for index in inspector.get_indexes("users")}
            if "ix_users_username" not in indexes:
                conn.execute(text("CREATE UNIQUE INDEX ix_users_username ON users (username)"))
