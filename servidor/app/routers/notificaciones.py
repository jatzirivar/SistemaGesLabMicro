"""Notificaciones del estudiante: /api/notificaciones (SRS 3.3 y 3.4)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import UsuarioSesion, requerir_estudiante
from app.schemas.auth import Mensaje
from app.schemas.prestamos import NotificacionRespuesta
from app.services import notificaciones_servicio as servicio

router = APIRouter(prefix="/api/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=list[NotificacionRespuesta])
def listar(no_leidas: bool = Query(False, description="true = solo las no leídas"),
           usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    return servicio.listar(db, usuario.id, no_leidas)


@router.patch("/{id_notificacion}/leida", response_model=NotificacionRespuesta)
def marcar_leida(id_notificacion: int, usuario: UsuarioSesion = Depends(requerir_estudiante),
                 db: Session = Depends(obtener_sesion)):
    return servicio.marcar_leida(db, usuario.id, id_notificacion)


@router.post("/leer-todas", response_model=Mensaje)
def leer_todas(usuario: UsuarioSesion = Depends(requerir_estudiante), db: Session = Depends(obtener_sesion)):
    cantidad = servicio.marcar_todas(db, usuario.id)
    return Mensaje(mensaje=f"{cantidad} notificación(es) marcadas como leídas")
