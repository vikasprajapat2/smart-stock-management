from sqlalchemy import crearte_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

engine= create_engine(DATABASES_URL)

Sessionlocal = sessionmaker(
    autocommit = False,
    autoflush = False,
    bind=engine
)
Base = Declarative_base()