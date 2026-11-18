"""Tablas PRESTAMO, DETALLE_PRESTAMO, INCIDENCIA, SANCION y NOTIFICACION."""
from datetime import date, datetime

from sqlalchemy import CHAR, Boolean, Date, DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constantes import EstadoPrestamo
from app.core.database import Base
from app.models.inventario import Equipo
from app.models.usuarios import Estudiante


class Prestamo(Base):
    __tablename__ = "prestamo"

    folio: Mapped[str] = mapped_column(String(16), primary_key=True)
    id_estudiante: Mapped[int] = mapped_column(ForeignKey("estudiante.id_estudiante"))
    grupo: Mapped[str] = mapped_column(String(6))
    id_estado_prestamo: Mapped[int] = mapped_column(SmallInteger, default=EstadoPrestamo.PENDIENTE)
    aceptacion_reglamento: Mapped[bool] = mapped_column(Boolean)
    fecha_hora_solicitud: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    fecha_hora_prog_retiro: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    prorroga: Mapped[bool] = mapped_column(Boolean, default=False)

    id_encargado_dictamen: Mapped[int | None] = mapped_column(ForeignKey("encargado.id_encargado"))
    fecha_hora_dictamen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    id_motivo_rechazo: Mapped[int | None] = mapped_column(SmallInteger)
    detalle_rechazo: Mapped[str | None] = mapped_column(String(255))

    codigo_pin: Mapped[str | None] = mapped_column(CHAR(4))
    intentos_pin: Mapped[int] = mapped_column(SmallInteger, default=0)
    pin_bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    id_encargado_entrega: Mapped[int | None] = mapped_column(ForeignKey("encargado.id_encargado"))
    fecha_hora_real_entrega: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    id_encargado_devolucion: Mapped[int | None] = mapped_column(ForeignKey("encargado.id_encargado"))
    fecha_hora_real_devolucion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    fecha_hora_cancelacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    motivo_cancelacion: Mapped[str | None] = mapped_column(String(255))

    estudiante: Mapped[Estudiante] = relationship()
    detalles: Mapped[list["DetallePrestamo"]] = relationship(
        back_populates="prestamo", cascade="all, delete-orphan", order_by="DetallePrestamo.codigo_inventario"
    )


class DetallePrestamo(Base):
    __tablename__ = "detalle_prestamo"

    folio_prestamo: Mapped[str] = mapped_column(ForeignKey("prestamo.folio"), primary_key=True)
    codigo_inventario: Mapped[str] = mapped_column(ForeignKey("equipo.codigo_inventario"), primary_key=True)
    entregado_completo: Mapped[bool | None] = mapped_column(Boolean)
    obs_entrega: Mapped[str | None] = mapped_column(String(255))
    id_inspec_devolucion: Mapped[int | None] = mapped_column(SmallInteger)
    obs_devolucion: Mapped[str | None] = mapped_column(String(255))

    prestamo: Mapped[Prestamo] = relationship(back_populates="detalles")
    equipo: Mapped[Equipo] = relationship()


class Incidencia(Base):
    __tablename__ = "incidencia"

    id_incidencia: Mapped[int] = mapped_column(Integer, primary_key=True)
    folio_prestamo: Mapped[str] = mapped_column(ForeignKey("prestamo.folio"))
    codigo_inventario: Mapped[str | None] = mapped_column(String(8))
    id_tipo_incidencia: Mapped[int] = mapped_column(SmallInteger)
    id_encargado: Mapped[int | None] = mapped_column(ForeignKey("encargado.id_encargado"))
    descripcion: Mapped[str] = mapped_column(String(255))
    resolucion: Mapped[str] = mapped_column(String(255))
    fecha_hora_registro: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Sancion(Base):
    __tablename__ = "sancion"

    id_sancion: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_estudiante: Mapped[int] = mapped_column(ForeignKey("estudiante.id_estudiante"))
    id_incidencia: Mapped[int | None] = mapped_column(ForeignKey("incidencia.id_incidencia"))
    id_encargado: Mapped[int | None] = mapped_column(ForeignKey("encargado.id_encargado"))
    motivo: Mapped[str] = mapped_column(String(255))
    fecha_inicio: Mapped[date] = mapped_column(Date)
    fecha_fin: Mapped[date | None] = mapped_column(Date)        # NULL = indefinida
    id_estado_sancion: Mapped[int] = mapped_column(SmallInteger, default=1)
    motivo_condonacion: Mapped[str | None] = mapped_column(String(255))


class Notificacion(Base):
    __tablename__ = "notificacion"

    id_notificacion: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_estudiante: Mapped[int] = mapped_column(ForeignKey("estudiante.id_estudiante"))
    folio_prestamo: Mapped[str | None] = mapped_column(ForeignKey("prestamo.folio"))
    titulo: Mapped[str] = mapped_column(String(100))
    mensaje: Mapped[str] = mapped_column(String(500))
    fecha_hora_generacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    id_estado_notificacion: Mapped[int] = mapped_column(SmallInteger, default=1)
