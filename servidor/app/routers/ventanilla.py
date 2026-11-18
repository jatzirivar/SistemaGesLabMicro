"""Ventanilla del encargado: /api/ventanilla (SRS 8.3 a 8.8)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import UsuarioSesion, requerir_encargado
from app.schemas.ventanilla import (
    DetalleVentanilla,
    RegistroDevolucion,
    RegistroEntrega,
    ResolucionEquipo,
    ResultadoBusqueda,
    ResultadoCodigo,
    ResultadoDevolucion,
    VerificarCodigo,
)
from app.services import ventanilla_servicio as servicio

router = APIRouter(prefix="/api/ventanilla", tags=["Ventanilla (encargado)"],
                   dependencies=[Depends(requerir_encargado)])

_BUSCAR = Query(..., min_length=1, description="Boleta (10 dígitos) o código de inventario de un equipo")


@router.get("/entregas", response_model=ResultadoBusqueda)
def buscar_entregas(buscar: str = _BUSCAR, db: Session = Depends(obtener_sesion)):
    """Préstamos Aprobados por entregar, con las verificaciones del SRS 8.4 en `bloqueos`."""
    return servicio.buscar_entregas(db, buscar)


@router.post("/entregas/{folio}/verificar-equipo", response_model=ResultadoCodigo)
def verificar_equipo(folio: str, datos: VerificarCodigo, db: Session = Depends(obtener_sesion)):
    """Al escribir o escanear un código: indica si pertenece al préstamo (SRS 8.5)."""
    return servicio.verificar_codigo(db, folio, datos.codigo_inventario)


@router.post("/entregas/{folio}", response_model=DetalleVentanilla)
def registrar_entrega(folio: str, datos: RegistroEntrega, encargado: UsuarioSesion = Depends(requerir_encargado),
                      db: Session = Depends(obtener_sesion)):
    """Checklist + PIN. Si todo es correcto: Entregada y equipos Prestado (SRS 8.5).

    - 400: PIN incorrecto (indica intentos restantes)
    - 423: PIN bloqueado 15 min tras 3 intentos
    """
    return servicio.registrar_entrega(db, encargado, folio, datos)


@router.get("/devoluciones", response_model=ResultadoBusqueda)
def buscar_devoluciones(buscar: str = _BUSCAR, db: Session = Depends(obtener_sesion)):
    """Préstamos Entregados o Vencidos, con minutos de retraso (SRS 8.6)."""
    return servicio.buscar_devoluciones(db, buscar)


@router.post("/devoluciones/{folio}", response_model=ResultadoDevolucion)
def registrar_devolucion(folio: str, datos: RegistroDevolucion,
                         encargado: UsuarioSesion = Depends(requerir_encargado),
                         db: Session = Depends(obtener_sesion)):
    """Inspección de cada equipo (Bueno / Dañado / Incompleto) e incidencias (SRS 8.6 a 8.8).

    Dañado exige incidencia de Daño; Incompleto, de Daño o Pérdida. El retraso se registra solo.
    Si algún equipo no queda en "Bueno", el préstamo sigue abierto hasta resolverlo.
    """
    return servicio.registrar_devolucion(db, encargado, folio, datos)


@router.post("/devoluciones/{folio}/equipos/{codigo}/resolver", response_model=ResultadoDevolucion)
def resolver_equipo(folio: str, codigo: str, datos: ResolucionEquipo,
                    encargado: UsuarioSesion = Depends(requerir_encargado),
                    db: Session = Depends(obtener_sesion)):
    """Marca como resuelto un equipo Dañado o Incompleto. Sin pendientes, el préstamo pasa a Devuelta."""
    return servicio.resolver_equipo(db, encargado, folio, codigo, datos.observaciones)


@router.get("/prestamos/{folio}", response_model=DetalleVentanilla)
def detalle(folio: str, db: Session = Depends(obtener_sesion)):
    """Detalle de cualquier préstamo para el encargado (sin PIN)."""
    return servicio.detalle(db, folio)
