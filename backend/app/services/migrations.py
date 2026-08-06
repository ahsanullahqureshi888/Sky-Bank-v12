from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


MIGRATIONS = {
    "users.username": "ALTER TABLE users ADD COLUMN username VARCHAR(80)",
    "settings.receipt_prefix": "ALTER TABLE settings ADD COLUMN receipt_prefix VARCHAR(40) DEFAULT 'TX'",
    "settings.auto_backup": "ALTER TABLE settings ADD COLUMN auto_backup BOOLEAN DEFAULT 0",
    "settings.last_backup_at": "ALTER TABLE settings ADD COLUMN last_backup_at VARCHAR(100)",
    "settings.next_receipt_number": "ALTER TABLE settings ADD COLUMN next_receipt_number INTEGER DEFAULT 1",
    "audit_logs.ip_address": "ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(100)",
    "audit_logs.device_info": "ALTER TABLE audit_logs ADD COLUMN device_info VARCHAR(255)",
}


def run_migrations(engine: Engine) -> None:
    """Apply only missing additive columns; safe to run on every startup."""
    inspector = inspect(engine)
    with engine.begin() as connection:
        for migration_key, statement in MIGRATIONS.items():
            table_name, column_name = migration_key.split(".", 1)
            if table_name not in inspector.get_table_names():
                continue
            columns = {column["name"] for column in inspector.get_columns(table_name)}
            if column_name not in columns:
                connection.execute(text(statement))

        inspector = inspect(connection)
        if "users" in inspector.get_table_names():
            indexes = {index["name"] for index in inspector.get_indexes("users")}
            if "ix_users_username" not in indexes:
                connection.execute(text("CREATE UNIQUE INDEX ix_users_username ON users (username)"))
