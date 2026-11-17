"""Conexión con PostgreSQL usando SQLAlchemy."""
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import configuracion

# URL.create escapa correctamente contraseñas con caracteres especiales (@, #, ñ...)
url_bd = URL.create(
    drivername="postgresql+psycopg",
    username=configuracion.db_usuario,
    password=configuracion.db_contrasena,
    host=configuracion.db_host,
    port=configuracion.db_puerto,
    database=configuracion.db_nombre,
)

motor = create_engine(
    url_bd,
    pool_pre_ping=True,  # revisa que la conexión siga viva antes de usarla
    connect_args={"options": f"-c timezone={configuracion.zona_horaria}"},
)

SesionLocal = sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Clase base de todos los modelos (tablas)."""


def obtener_sesion():
    """Entrega una sesión de BD por petición y la cierra al terminar."""
    sesion = SesionLocal()
    try:
        yield sesion
    finally:
        sesion.close()
