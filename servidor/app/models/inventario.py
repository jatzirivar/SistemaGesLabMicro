"""Tablas CATEGORIA y EQUIPO (creadas por 01_esquema.sql)."""
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constantes import EstadoEquipo
from app.core.database import Base


class Categoria(Base):
    __tablename__ = "categoria"

    id_categoria: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60))
    prefijo: Mapped[str] = mapped_column(String(4))
    ultimo_consecutivo: Mapped[int] = mapped_column(Integer, default=0)


class Equipo(Base):
    __tablename__ = "equipo"

    # El código (OSC-001) lo genera la función fn_siguiente_codigo de la BD
    codigo_inventario: Mapped[str] = mapped_column(String(8), primary_key=True)
    id_categoria: Mapped[int] = mapped_column(ForeignKey("categoria.id_categoria"))
    nombre: Mapped[str] = mapped_column(String(100))
    descripcion: Mapped[str] = mapped_column(Text)
    especificaciones: Mapped[str] = mapped_column(Text)
    componentes_incluidos: Mapped[str] = mapped_column(Text)
    fotografia: Mapped[str | None] = mapped_column(String(255))
    manual: Mapped[str | None] = mapped_column(String(255))
    fecha_adquisicion: Mapped[date] = mapped_column(Date)
    id_estado_equipo: Mapped[int] = mapped_column(SmallInteger, default=EstadoEquipo.DISPONIBLE)
    motivo_baja: Mapped[str | None] = mapped_column(String(255))
    fecha_baja: Mapped[date | None] = mapped_column(Date)

    categoria: Mapped[Categoria] = relationship()

    @property
    def estado(self) -> str:
        return EstadoEquipo.NOMBRES.get(self.id_estado_equipo, "Desconocido")
