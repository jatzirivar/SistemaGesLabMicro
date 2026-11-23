"""Dictamen de solicitudes (encargado): /api/encargado/solicitudes (SRS 8.1 y 8.2)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import UsuarioSesion, requerir_encargado
from app.schemas.auth import Mensaje
from app.schemas.prestamos import MotivoRechazoRespuesta, Rechazo, SolicitudPendiente
from app.services import dictamen_servicio as servicio

router = APIRouter(prefix="/api/encargado/solicitudes", tags=["Dictamen (encargado)"])


@router.get("/pendientes", response_model=list[SolicitudPendiente])
def pendientes(_: UsuarioSesion = Depends(requerir_encargado), db: Session = Depends(obtener_sesion)):
    """Solicitudes Pendiente ordenadas por hora de retiro, con alertas del alumno."""
    return servicio.solicitudes_pendientes(db)


@router.get("/motivos-rechazo", response_model=list[MotivoRechazoRespuesta])
def motivos(_: UsuarioSesion = Depends(requerir_encargado)):
    """Checklist estandarizado de motivos (SRS 8.2)."""
    return servicio.motivos_rechazo()


@router.post("/{folio}/aprobar", response_model=Mensaje)
def aprobar(folio: str, encargado: UsuarioSesion = Depends(requerir_encargado),
            db: Session = Depends(obtener_sesion)):
    """Aprueba y genera el PIN de 4 dígitos. El PIN solo lo ve el estudiante."""
    folio = servicio.aprobar(db, encargado, folio)
    return Mensaje(mensaje=f"Solicitud {folio} aprobada")


@router.post("/{folio}/rechazar", response_model=Mensaje)
def rechazar(folio: str, datos: Rechazo, encargado: UsuarioSesion = Depends(requerir_encargado),
             db: Session = Depends(obtener_sesion)):
    """Rechaza con un motivo del checklist; "Otro" (5) exige escribir el detalle."""
    folio = servicio.rechazar(db, encargado, folio, datos)
    return Mensaje(mensaje=f"Solicitud {folio} rechazada")
