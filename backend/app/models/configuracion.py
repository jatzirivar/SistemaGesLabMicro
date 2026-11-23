"""Tablas CONFIGURACION_LAB y DIA_INHABIL."""
from datetime import date, time

from sqlalchemy import ARRAY, Date, SmallInteger, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfiguracionLab(Base):
    __tablename__ = "configuracion_lab"

    id_configuracion: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    horario_apertura: Mapped[time] = mapped_column(Time)        # primera hora para retirar
    horario_cierre: Mapped[time] = mapped_column(Time)          # última hora para retirar
    hora_limite_devolucion: Mapped[time] = mapped_column(Time)  # última hora para devolver
    dias_servicio: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))  # 1 = lunes ... 7 = domingo
    duracion_ordinaria: Mapped[int] = mapped_column(SmallInteger)  # minutos
    duracion_prorroga: Mapped[int] = mapped_column(SmallInteger)   # minutos
    duracion_maxima: Mapped[int] = mapped_column(SmallInteger)     # minutos
    limite_equipos: Mapped[int] = mapped_column(SmallInteger)
    limite_por_modelo: Mapped[int] = mapped_column(SmallInteger)
    tolerancia_retiro: Mapped[int] = mapped_column(SmallInteger)   # minutos


class DiaInhabil(Base):
    __tablename__ = "dia_inhabil"

    fecha_inhabil: Mapped[date] = mapped_column(Date, primary_key=True)
    descripcion: Mapped[str] = mapped_column(String(100))
