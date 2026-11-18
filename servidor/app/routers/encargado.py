"""Panel, incidencias y sanciones del encargado: /api/encargado (SRS 8, 8.7 y 8.9)."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import UsuarioSesion, requerir_encargado
from app.schemas.ventanilla import (
    IncidenciaRespuesta,
    PanelEncargado,
    RetiroSancion,
    SancionManual,
    SancionRespuesta,
)
from app.services import sanciones_servicio, ventanilla_servicio

router = APIRouter(prefix="/api/encargado", tags=["Panel, incidencias y sanciones (encargado)"],
                   dependencies=[Depends(requerir_encargado)])


@router.get("/panel", response_model=PanelEncargado)
def panel(db: Session = Depends(obtener_sesion)):
    """Contadores del Panel Operativo y categorías con bajo stock (SRS 8)."""
    return ventanilla_servicio.panel(db)


@router.get("/incidencias", response_model=list[IncidenciaRespuesta])
def incidencias(buscar: str | None = Query(None, description="Folio, boleta o código de equipo"),
                db: Session = Depends(obtener_sesion)):
    return sanciones_servicio.listar_incidencias(db, buscar)


@router.get("/sanciones", response_model=list[SancionRespuesta])
def sanciones(boleta: str | None = Query(None), solo_vigentes: bool = Query(True),
              db: Session = Depends(obtener_sesion)):
    return sanciones_servicio.listar_sanciones(db, boleta, solo_vigentes)


@router.post("/sanciones", response_model=SancionRespuesta, status_code=status.HTTP_201_CREATED)
def aplicar_sancion(datos: SancionManual, encargado: UsuarioSesion = Depends(requerir_encargado),
                    db: Session = Depends(obtener_sesion)):
    """Bloqueo manual: Retraso 7 días, Daño 15 días, Pérdida indefinida (SRS 8.9)."""
    return sanciones_servicio.aplicar_sancion_manual(db, encargado, datos)


@router.post("/sanciones/{id_sancion}/retirar", response_model=SancionRespuesta)
def retirar_sancion(id_sancion: int, datos: RetiroSancion, encargado: UsuarioSesion = Depends(requerir_encargado),
                    db: Session = Depends(obtener_sesion)):
    """Retiro manual con motivo; queda como Condonada (SRS 8.9)."""
    return sanciones_servicio.retirar_sancion(db, encargado, id_sancion, datos.motivo)
