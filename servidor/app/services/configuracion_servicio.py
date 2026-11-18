"""Reglas y configuración del sistema (SRS 8.14)."""
from datetime import datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constantes import EstadoPrestamo
from app.core.errores import ErrorDeNegocio
from app.core.tiempo import ZONA, hoy
from app.models.configuracion import DiaInhabil
from app.models.prestamos import Prestamo
from app.schemas.administracion import ConfiguracionActualizar, DiaInhabilCrear
from app.services import prestamos_comun as comun

_DIAS = {1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo"}


def obtener(db: Session) -> dict:
    c = comun.configuracion_lab(db)
    sanciones = db.execute(text(
        "SELECT tipo, dias_sancion FROM tipo_incidencia ORDER BY id_tipo_incidencia")).all()
    return {
        "horario_apertura": c.horario_apertura,
        "horario_cierre": c.horario_cierre,
        "hora_limite_devolucion": c.hora_limite_devolucion,
        "dias_servicio": [_DIAS[d] for d in sorted(c.dias_servicio)],
        "duracion_ordinaria": c.duracion_ordinaria,
        "duracion_prorroga": c.duracion_prorroga,
        "duracion_maxima": c.duracion_maxima,
        "limite_equipos": c.limite_equipos,
        "limite_por_modelo": c.limite_por_modelo,
        "tolerancia_retiro": c.tolerancia_retiro,
        "duraciones_sancion": [{"tipo": t, "dias": d} for t, d in sanciones],
    }


def actualizar(db: Session, datos: ConfiguracionActualizar) -> dict:
    c = comun.configuracion_lab(db)
    if datos.duracion_maxima < c.duracion_ordinaria:
        raise ErrorDeNegocio(f"La duración máxima no puede ser menor que la duración de un préstamo "
                             f"({c.duracion_ordinaria} minutos)", 422)

    # Con retiro a la última hora, la devolución ordinaria debe caber antes del límite
    ultima = datetime.combine(hoy(), datos.horario_cierre) + timedelta(minutes=c.duracion_ordinaria)
    if ultima.date() != hoy() or ultima.time() > datos.hora_limite_devolucion:
        raise ErrorDeNegocio(
            f"Con la última hora de retiro ({datos.horario_cierre:%H:%M}) la devolución sería a las "
            f"{ultima:%H:%M}, después del límite ({datos.hora_limite_devolucion:%H:%M})", 422)

    c.horario_apertura = datos.horario_apertura.replace(second=0, microsecond=0, tzinfo=None)
    c.horario_cierre = datos.horario_cierre.replace(second=0, microsecond=0, tzinfo=None)
    c.hora_limite_devolucion = datos.hora_limite_devolucion.replace(second=0, microsecond=0, tzinfo=None)
    c.duracion_maxima = datos.duracion_maxima
    c.limite_equipos = datos.limite_equipos
    c.tolerancia_retiro = datos.tolerancia_retiro
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ErrorDeNegocio("Los valores no cumplen las reglas de la configuración", 422)
    return obtener(db)


# ================================================================ días inhábiles

def listar_dias(db: Session, incluir_pasados: bool) -> list[dict]:
    consulta = select(DiaInhabil).order_by(DiaInhabil.fecha_inhabil)
    if not incluir_pasados:
        consulta = consulta.where(DiaInhabil.fecha_inhabil >= hoy())
    return [{"fecha": d.fecha_inhabil, "descripcion": d.descripcion} for d in db.scalars(consulta)]


def agregar_dia(db: Session, datos: DiaInhabilCrear) -> dict:
    if datos.fecha < hoy():
        raise ErrorDeNegocio("No se puede marcar como inhábil un día que ya pasó", 422)
    if db.get(DiaInhabil, datos.fecha):
        raise ErrorDeNegocio(f"El {datos.fecha:%d/%m/%Y} ya está registrado como día inhábil")

    db.add(DiaInhabil(fecha_inhabil=datos.fecha, descripcion=datos.descripcion))
    db.commit()

    # Las solicitudes que ya existen para ese día NO se cancelan solas: se informan al encargado
    inicio = datetime.combine(datos.fecha, time(0, 0), tzinfo=ZONA)
    afectadas = list(db.scalars(
        select(Prestamo.folio).where(
            Prestamo.id_estado_prestamo.in_((EstadoPrestamo.PENDIENTE, EstadoPrestamo.APROBADA)),
            Prestamo.fecha_hora_prog_retiro >= inicio,
            Prestamo.fecha_hora_prog_retiro < inicio + timedelta(days=1),
        ).order_by(Prestamo.fecha_hora_prog_retiro)
    ))
    mensaje = "Día inhábil registrado"
    if afectadas:
        mensaje += (f". Hay {len(afectadas)} solicitud(es) Pendiente o Aprobada para ese día; "
                    "revísalas (rechazar las pendientes o avisar a los alumnos)")
    return {"dia": {"fecha": datos.fecha, "descripcion": datos.descripcion},
            "solicitudes_afectadas": afectadas, "mensaje": mensaje}


def eliminar_dia(db: Session, fecha) -> None:
    dia = db.get(DiaInhabil, fecha)
    if dia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese día no está registrado como inhábil")
    db.delete(dia)
    db.commit()
