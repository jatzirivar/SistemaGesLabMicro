"""Solicitudes del estudiante: /api/solicitudes y /api/estudiante/panel."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import UsuarioSesion, requerir_estudiante
from app.schemas.prestamos import (
    Comprobante,
    DatosSolicitud,
    DetallePrestamoRespuesta,
    EnvioSolicitud,
    MisSolicitudes,
    PanelEstudiante,
    RevisionSolicitud,
    SolicitudCreada,
)
from app.schemas.ventanilla import HistorialEstudiante
from app.services import sanciones_servicio
from app.services import solicitudes_servicio as servicio

router = APIRouter(prefix="/api/solicitudes", tags=["Solicitudes (estudiante)"])
router_panel = APIRouter(prefix="/api/estudiante", tags=["Solicitudes (estudiante)"])


@router_panel.get("/panel", response_model=PanelEstudiante)
def panel(usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    """Préstamos activos, pendientes y alertas para el banner rojo (SRS 3)."""
    return servicio.panel(db, usuario)


@router_panel.get("/historial", response_model=HistorialEstudiante)
def historial(usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    """Incidencias y sanciones del alumno, con fechas de inicio y fin (SRS 3.2)."""
    return sanciones_servicio.historial_estudiante(db, usuario.id)


@router.post("/verificar", response_model=RevisionSolicitud)
def verificar(datos: DatosSolicitud, usuario: UsuarioSesion = Depends(requerir_estudiante),
              db: Session = Depends(obtener_sesion)):
    """Revisa carrito y horario SIN guardar. Sirve para habilitar el botón "Enviar solicitud"."""
    return servicio.verificar_solicitud(db, usuario, datos)


@router.post("", response_model=SolicitudCreada, status_code=status.HTTP_201_CREATED)
def enviar(datos: EnvioSolicitud, usuario: UsuarioSesion = Depends(requerir_estudiante),
           db: Session = Depends(obtener_sesion)):
    """Envía la solicitud: queda Pendiente y aparta los equipos en ese horario (SRS 6.1)."""
    prestamo = servicio.crear_solicitud(db, usuario, datos)
    return {
        "folio": prestamo.folio,
        "mensaje": f"Solicitud enviada con folio {prestamo.folio}",
        "solicitud": servicio.a_detalle(db, prestamo),
    }


@router.get("", response_model=MisSolicitudes)
def mis_solicitudes(usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    """En curso, en revisión y finalizadas (SRS 3.1)."""
    return servicio.mis_solicitudes(db, usuario)


@router.get("/{folio}", response_model=DetallePrestamoRespuesta)
def detalle(folio: str, usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    """Detalle con línea de tiempo y PIN si está Aprobada (SRS 7 y 7.1)."""
    return servicio.a_detalle(db, servicio.obtener_prestamo(db, usuario, folio))


@router.post("/{folio}/cancelar", response_model=DetallePrestamoRespuesta)
def cancelar(folio: str, usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    """Solo Pendiente, o Aprobada antes de la hora de retiro. Revoca el PIN (SRS 6.2)."""
    return servicio.a_detalle(db, servicio.cancelar(db, usuario, folio))


@router.post("/{folio}/prorroga", response_model=DetallePrestamoRespuesta)
def prorroga(folio: str, usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    """Una sola extensión de 1 hora para un préstamo Entregada (SRS 6.3)."""
    return servicio.a_detalle(db, servicio.prorrogar(db, usuario, folio))


@router.get("/{folio}/comprobante", response_model=Comprobante)
def comprobante(folio: str, usuario: UsuarioSesion = Depends(requerir_estudiante),
                db: Session = Depends(obtener_sesion)):
    """Datos del comprobante de retiro (SRS 7.3). El PDF se agrega en el módulo de reportes."""
    return servicio.comprobante(db, usuario, folio)
