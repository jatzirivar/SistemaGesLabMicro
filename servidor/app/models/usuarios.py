"""Tablas ESTUDIANTE y ENCARGADO.

Las tablas ya existen (las crea 01_esquema.sql); estas clases solo las
describen para poder leerlas y escribirlas desde Python.
"""
from datetime import datetime

from sqlalchemy import CHAR, DateTime, Integer, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constantes import EstadoCuenta
from app.core.database import Base


class _DatosDeCuenta:
    """Columnas comunes a estudiantes y encargados."""

    nombre: Mapped[str] = mapped_column(String(60))
    apellido_pat: Mapped[str] = mapped_column(String(60))
    apellido_mat: Mapped[str | None] = mapped_column(String(60))
    correo: Mapped[str] = mapped_column(String(120))
    contrasena_hash: Mapped[str] = mapped_column(String(255))
    intentos_fallidos: Mapped[int] = mapped_column(SmallInteger, default=0)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    id_estado_cuenta: Mapped[int] = mapped_column(SmallInteger, default=EstadoCuenta.ACTIVA)
    fecha_registro: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def nombre_completo(self) -> str:
        return " ".join(p for p in (self.nombre, self.apellido_pat, self.apellido_mat) if p)


class Estudiante(_DatosDeCuenta, Base):
    __tablename__ = "estudiante"

    id_estudiante: Mapped[int] = mapped_column(Integer, primary_key=True)
    boleta: Mapped[str] = mapped_column(CHAR(10))

    @property
    def id(self) -> int:
        return self.id_estudiante


class Encargado(_DatosDeCuenta, Base):
    __tablename__ = "encargado"

    id_encargado: Mapped[int] = mapped_column(Integer, primary_key=True)

    @property
    def id(self) -> int:
        return self.id_encargado
