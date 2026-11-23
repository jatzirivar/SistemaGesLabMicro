"""Tareas automáticas. El servidor las ejecuta cada minuto (ver app/main.py).

1. Pendientes que nadie revisó antes de terminar la tolerancia de retiro -> Cancelada.
2. Aprobadas que no se recogieron en la tolerancia (30 min) -> Cancelada + incidencia
   "No retiro" + sanción de 2 días. Si algún equipo no estaba disponible en el laboratorio
   (por ejemplo, otro alumno no lo devolvió), se cancela sin sanción.
3. Entregadas que pasaron su hora límite -> Vencida.
4. Recordatorio 15 minutos antes de la hora de devolución (SRS 3.4).
5. Sanciones con plazo cuyo último día ya pasó -> Cumplida (SRS 8.9).
"""
import logging
from datetime import timedelta

from sqlalchemy import DateTime, exists, func, select, text, update
from sqlalchemy.orm import Session

from app.core.constantes import (
    DIAS_SANCION_NO_RETIRO,
    MINUTOS_RECORDATORIO_DEVOLUCION,
    EstadoEquipo,
    EstadoPrestamo,
    EstadoSancion,
    TipoIncidencia,
)
from app.core.database import SesionLocal
from app.core.tiempo import a_local, ahora, hoy
from app.models.prestamos import Incidencia, Notificacion, Prestamo, Sancion
from app.services import prestamos_comun as comun

log = logging.getLogger("uvicorn.error")

# Número arbitrario para que solo un proceso ejecute las tareas a la vez
_ID_CANDADO = 20261118
_TITULO_RECORDATORIO = "Recordatorio de devolución"


def _limite_sql():
    return func.fn_limite_devolucion(Prestamo.fecha_hora_prog_retiro, Prestamo.prorroga,
                                     type_=DateTime(timezone=True))


def ejecutar(db: Session) -> dict:
    resultado = {"pendientes_canceladas": 0, "aprobadas_no_retiradas": 0,
                 "aprobadas_canceladas_sin_sancion": 0, "prestamos_vencidos": 0,
                 "recordatorios_enviados": 0, "sanciones_cumplidas": 0}

    # Si otro proceso ya las está ejecutando, no se hace nada
    if not db.scalar(text("SELECT pg_try_advisory_xact_lock(:id)"), {"id": _ID_CANDADO}):
        return resultado

    config = comun.configuracion_lab(db)
    momento = ahora()
    corte_retiro = momento - timedelta(minutes=config.tolerancia_retiro)

    # 1. Pendientes sin dictamen ---------------------------------------------
    for p in db.scalars(select(Prestamo).where(
            Prestamo.id_estado_prestamo == EstadoPrestamo.PENDIENTE,
            Prestamo.fecha_hora_prog_retiro < corte_retiro).with_for_update(skip_locked=True)).all():
        p.id_estado_prestamo = EstadoPrestamo.CANCELADA
        p.fecha_hora_cancelacion = momento
        p.motivo_cancelacion = "Cancelada automáticamente: no fue revisada antes de la hora de retiro"
        comun.notificar(db, p.id_estudiante, "Solicitud cancelada",
                        f"Tu solicitud {p.folio} se canceló porque no fue revisada a tiempo. "
                        "Puedes enviar una nueva.", p.folio)
        resultado["pendientes_canceladas"] += 1

    # 2. Aprobadas no recogidas: cancelación + sanción ------------------------
    dias = db.scalar(text("SELECT dias_sancion FROM tipo_incidencia WHERE id_tipo_incidencia = :t"),
                     {"t": TipoIncidencia.NO_RETIRO}) or DIAS_SANCION_NO_RETIRO
    for p in db.scalars(select(Prestamo).where(
            Prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA,
            Prestamo.fecha_hora_prog_retiro < corte_retiro).with_for_update(skip_locked=True)).all():
        p.id_estado_prestamo = EstadoPrestamo.CANCELADA
        p.codigo_pin = None
        p.fecha_hora_cancelacion = momento

        # Si algún equipo no estaba disponible en el laboratorio (otro alumno no lo devolvió,
        # se dañó o se dio de baja), no se pudo entregar: se cancela SIN sanción.
        no_disponibles = [d.codigo_inventario for d in p.detalles
                          if d.equipo.id_estado_equipo != EstadoEquipo.DISPONIBLE]
        if no_disponibles:
            equipos = ", ".join(no_disponibles)
            p.motivo_cancelacion = (f"Cancelada automáticamente sin sanción: {equipos} no estaba disponible "
                                    "en el laboratorio a la hora de retiro")
            comun.notificar(db, p.id_estudiante, "Préstamo cancelado sin sanción",
                            f"Tu préstamo {p.folio} se canceló porque {equipos} no estaba disponible a la "
                            "hora de retiro (por ejemplo, otro alumno no lo devolvió a tiempo). No tienes "
                            "sanción; puedes enviar una nueva solicitud.", p.folio)
            resultado["aprobadas_canceladas_sin_sancion"] += 1
            continue

        p.motivo_cancelacion = (f"Cancelada automáticamente: no se recogió dentro de los "
                                f"{config.tolerancia_retiro} minutos de tolerancia")

        incidencia = Incidencia(
            folio_prestamo=p.folio,
            codigo_inventario=None,
            id_tipo_incidencia=TipoIncidencia.NO_RETIRO,
            id_encargado=None,
            descripcion=f"El préstamo aprobado no se recogió; retiro programado a las "
                        f"{a_local(p.fecha_hora_prog_retiro):%H:%M}",
            resolucion=f"Cancelación automática y sanción de {dias} días",
        )
        db.add(incidencia)
        db.flush()  # para obtener id_incidencia
        sancion = comun.crear_sancion(db, p.id_estudiante, f"No recogió el préstamo {p.folio}",
                                      dias, id_incidencia=incidencia.id_incidencia)
        comun.notificar(db, p.id_estudiante, "Préstamo cancelado y sanción",
                        f"No recogiste el préstamo {p.folio} a tiempo. Se canceló y tienes una sanción "
                        f"hasta el {sancion.fecha_fin:%d/%m/%Y}.", p.folio)
        resultado["aprobadas_no_retiradas"] += 1

    # 3. Entregadas que vencieron --------------------------------------------
    for p in db.scalars(select(Prestamo).where(
            Prestamo.id_estado_prestamo == EstadoPrestamo.ENTREGADA,
            Prestamo.fecha_hora_real_devolucion.is_(None),   # los devueltos con pendientes no vencen
            _limite_sql() < momento).with_for_update(skip_locked=True)).all():
        p.id_estado_prestamo = EstadoPrestamo.VENCIDA
        comun.notificar(db, p.id_estudiante, "Préstamo vencido",
                        f"Tu préstamo {p.folio} venció. Devuelve el equipo en ventanilla lo antes posible; "
                        "el retraso genera una sanción de 7 días.", p.folio)
        resultado["prestamos_vencidos"] += 1

    # 4. Recordatorio antes de la devolución ---------------------------------
    ya_avisado = exists().where(Notificacion.folio_prestamo == Prestamo.folio,
                                Notificacion.titulo == _TITULO_RECORDATORIO)
    for p in db.scalars(select(Prestamo).where(
            Prestamo.id_estado_prestamo == EstadoPrestamo.ENTREGADA,
            Prestamo.fecha_hora_real_devolucion.is_(None),
            _limite_sql() >= momento,
            _limite_sql() <= momento + timedelta(minutes=MINUTOS_RECORDATORIO_DEVOLUCION),
            ~ya_avisado)).all():
        limite = comun.limite_de(p, config)
        comun.notificar(db, p.id_estudiante, _TITULO_RECORDATORIO,
                        f"Te quedan {MINUTOS_RECORDATORIO_DEVOLUCION} minutos. Después de las "
                        f"{limite:%H:%M} se aplica sanción por retraso.", p.folio)
        resultado["recordatorios_enviados"] += 1

    # 5. Sanciones cumplidas --------------------------------------------------
    cumplidas = db.execute(
        update(Sancion)
        .where(Sancion.id_estado_sancion == EstadoSancion.VIGENTE,
               Sancion.fecha_fin.is_not(None),
               Sancion.fecha_fin < hoy())
        .values(id_estado_sancion=EstadoSancion.CUMPLIDA)
    )
    resultado["sanciones_cumplidas"] = cumplidas.rowcount

    db.commit()
    if any(resultado.values()):
        log.info("Tareas automáticas: %s", resultado)
    return resultado


def ejecutar_con_sesion_propia() -> dict:
    """Para el ciclo en segundo plano: abre y cierra su propia sesión."""
    with SesionLocal() as db:
        return ejecutar(db)
