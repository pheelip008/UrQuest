import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def upgrade_schema():
    """Apply small, idempotent compatibility migrations for existing deployments.

    SQLAlchemy's ``create_all`` creates missing tables but deliberately does not
    add columns to tables that already exist. Render's database predates these
    fields, so upgrade it before serving requests.
    """
    if engine.dialect.name != "postgresql":
        return

    missing_columns = {
        "users": {"bio": "VARCHAR"},
        "organizations": {"is_private": "BOOLEAN"},
        "tasks": {"category": "VARCHAR"},
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, columns in missing_columns.items():
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in columns.items():
                if column_name not in existing:
                    # Table and column names are fixed application constants.
                    connection.execute(text(
                        f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {column_type}'
                    ))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
