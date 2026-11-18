"""Dictamen de solicitudes por el encargado (SRS 8.1 y 8.2)."""
import secrets

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constantes import EstadoEquipo, EstadoPrestamo, MotivoRechazo
from app.core.dependencias import UsuarioSesion
from app.core.errores import ErrorDeNegocio
from app.core.tiempo import a_local, ahora
from app.models.prestamos import Prestamo
from app.schemas.prestamos import Rechazo
from app.services import prestamos_comun as comun


def solicitudes_pendientes(db: Session) -> list[dict]:
    """Todas las Pendiente, de la retirada más próxima a la más lejana (SRS 8.1)."""
    config = comun.configuracion_lab(db)
    prestamos = db.scalars(
        select(Prestamo).options(comun.CARGAR_EQUIPOS)
        .where(Prestamo.id_estado_prestamo == EstadoPrestamo.PENDIENTE)
        .order_by(Prestamo.fecha_hora_prog_retiro, Prestamo.folio)
    ).all()

    alertas_por_alumno: dict[int, list[str]] = {}
    filas = []
    for p in prestamos:
        if p.id_estudiante not in alertas_por_alumno:
            # Mismo texto que ve el alumno, pero en tercera persona
            alertas_por_alumno[p.id_estudiante] = [
                a.replace("Tu cuenta", "La cuenta").replace("Tienes", "Tiene")
                for a in comun.alertas_estudiante(db, p.estudiante)
            ]
        alertas = list(alertas_por_alumno[p.id_estudiante])
        for d in p.detalles:
            if d.equipo.id_estado_equipo == EstadoEquipo.EN_MANTENIMIENTO:
                alertas.append(f"{d.codigo_inventario} está en mantenimiento")
            elif d.equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA:
                alertas.append(f"{d.codigo_inventario} fue dado de baja")

        filas.append({
            "folio": p.folio,
            "estudiante": p.estudiante.nombre_completo,
            "boleta": p.estudiante.boleta,
            "grupo": p.grupo,
            "equipos": comun.equipos_de(p),
            "fecha_hora_solicitud": a_local(p.fecha_hora_solicitud),
            "fecha_hora_prog_retiro": a_local(p.fecha_hora_prog_retiro),
            "fecha_hora_limite_devolucion": comun.limite_de(p, config),
            "alertas": alertas,
        })
    return filas


def _pendiente_bloqueada(db: Session, folio: str) -> Prestamo:
    prestamo = db.scalar(select(Prestamo).where(Prestamo.folio == folio.strip().upper()).with_for_update())
    if prestamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    if prestamo.id_estado_prestamo != EstadoPrestamo.PENDIENTE:
        estado = EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo]
        raise ErrorDeNegocio(f"La solicitud ya no está pendiente (estado actual: {estado})")
    return prestamo


def _pin_libre(db: Session) -> str:
    """PIN de 4 dígitos que no use ningún otro préstamo Aprobado (SRS 7.1)."""
    for _ in range(100):
        pin = f"{secrets.randbelow(10_000):04d}"
        en_uso = db.scalar(select(Prestamo.folio).where(
            Prestamo.codigo_pin == pin, Prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA))
        if not en_uso:
            return pin
    raise ErrorDeNegocio("No se pudo generar un PIN, intenta de nuevo", 503)


def aprobar(db: Session, encargado: UsuarioSesion, folio: str) -> str:
    prestamo = _pendiente_bloqueada(db, folio)
    config = comun.configuracion_lab(db)

    if ahora() > comun.fin_de_tolerancia(prestamo, config):
        raise ErrorDeNegocio("Ya pasó la hora de retiro y su tolerancia; la solicitud se cancelará automáticamente")
    dados_de_baja = [d.codigo_inventario for d in prestamo.detalles
                     if d.equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA]
    if dados_de_baja:
        raise ErrorDeNegocio(f"No se puede aprobar: {', '.join(dados_de_baja)} fue dado de baja. Recházala.")

    prestamo.codigo_pin = _pin_libre(db)
    prestamo.intentos_pin = 0
    prestamo.pin_bloqueado_hasta = None
    prestamo.id_estado_prestamo = EstadoPrestamo.APROBADA
    prestamo.id_encargado_dictamen = encargado.id
    prestamo.fecha_hora_dictamen = ahora()

    retiro = a_local(prestamo.fecha_hora_prog_retiro)
    comun.notificar(db, prestamo.id_estudiante, "Solicitud aprobada",
                    f"Tu solicitud {prestamo.folio} fue aprobada. Preséntate en ventanilla el "
                    f"{retiro:%d/%m/%Y} a las {retiro:%H:%M} (tolerancia de {config.tolerancia_retiro} min) "
                    f"con tu PIN, que aparece en el detalle de la solicitud.", prestamo.folio)
    try:
        db.commit()
    except IntegrityError:
        # Otro préstamo tomó el mismo PIN en el mismo instante (muy raro)
        db.rollback()
        raise ErrorDeNegocio("No se pudo generar un PIN único, intenta de nuevo", 503)
    return prestamo.folio


def rechazar(db: Session, encargado: UsuarioSesion, folio: str, datos: Rechazo) -> str:
    if datos.id_motivo_rechazo == MotivoRechazo.OTRO and not datos.detalle:
        raise ErrorDeNegocio("Escribe el motivo cuando eliges «Otro»", 422)

    prestamo = _pendiente_bloqueada(db, folio)
    prestamo.id_estado_prestamo = EstadoPrestamo.RECHAZADA
    prestamo.id_motivo_rechazo = datos.id_motivo_rechazo
    prestamo.detalle_rechazo = datos.detalle
    prestamo.id_encargado_dictamen = encargado.id
    prestamo.fecha_hora_dictamen = ahora()

    comun.notificar(db, prestamo.id_estudiante, "Solicitud rechazada",
                    f"Tu solicitud {prestamo.folio} fue rechazada. Motivo: {comun.motivo_rechazo_texto(prestamo)}.",
                    prestamo.folio)
    db.commit()
    return prestamo.folio


def motivos_rechazo() -> list[dict]:
    return [{"id_motivo_rechazo": i, "motivo": m} for i, m in MotivoRechazo.NOMBRES.items()]
