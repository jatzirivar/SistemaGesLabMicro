"""Avisos del estudiante con estado leído/no leído (SRS 3.3 y 3.4)."""
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.constantes import EstadoNotificacion
from app.core.tiempo import a_local
from app.models.prestamos import Notificacion


def _a_json(n: Notificacion) -> dict:
    return {
        "id_notificacion": n.id_notificacion,
        "titulo": n.titulo,
        "mensaje": n.mensaje,
        "folio_prestamo": n.folio_prestamo,
        "fecha_hora_generacion": a_local(n.fecha_hora_generacion),
        "leida": n.id_estado_notificacion == EstadoNotificacion.LEIDA,
    }


def listar(db: Session, id_estudiante: int, solo_no_leidas: bool) -> list[dict]:
    consulta = select(Notificacion).where(Notificacion.id_estudiante == id_estudiante)
    if solo_no_leidas:
        consulta = consulta.where(Notificacion.id_estado_notificacion == EstadoNotificacion.NO_LEIDA)
    notificaciones = db.scalars(
        consulta.order_by(Notificacion.fecha_hora_generacion.desc(), Notificacion.id_notificacion.desc()).limit(100)
    )
    return [_a_json(n) for n in notificaciones]


def marcar_leida(db: Session, id_estudiante: int, id_notificacion: int) -> dict:
    notificacion = db.get(Notificacion, id_notificacion)
    if notificacion is None or notificacion.id_estudiante != id_estudiante:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notificación no encontrada")
    notificacion.id_estado_notificacion = EstadoNotificacion.LEIDA
    db.commit()
    return _a_json(notificacion)


def marcar_todas(db: Session, id_estudiante: int) -> int:
    resultado = db.execute(
        update(Notificacion)
        .where(Notificacion.id_estudiante == id_estudiante,
               Notificacion.id_estado_notificacion == EstadoNotificacion.NO_LEIDA)
        .values(id_estado_notificacion=EstadoNotificacion.LEIDA)
    )
    db.commit()
    return resultado.rowcount
