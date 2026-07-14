from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass

# PostgreSQL naming conventions for automated explicit constraint naming
POSTGRES_NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=POSTGRES_NAMING_CONVENTION)


class Base(MappedAsDataclass, DeclarativeBase):
    """
    SQLAlchemy Base class combining MappedAsDataclass and DeclarativeBase.
    Correct ordering: MappedAsDataclass must come BEFORE DeclarativeBase.
    All Mixin classes used in models must ALSO subclass MappedAsDataclass.
    """

    metadata = metadata
