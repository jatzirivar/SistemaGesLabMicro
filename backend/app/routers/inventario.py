"""Mantenimiento del inventario (solo encargado): /api/inventario/equipos

SRS 8.8, 8.10, 8.11 y 8.12.
"""
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.constantes import EQUIPOS_POR_PAGINA
from app.core.database import obtener_sesion
from app.core.dependencias import requerir_encargado
from app.schemas.auth import Mensaje
from app.schemas.inventario import (
    BajaEquipo,
    CambioEstadoEquipo,
    EquipoActualizar,
    EquipoCrear,
    EquipoInventario,
    Pagina,
)
from app.services import inventario_servicio as servicio

router = APIRouter(
    prefix="/api/inventario/equipos",
    tags=["Inventario (encargado)"],
    dependencies=[Depends(requerir_encargado)],
)


@router.get("", response_model=Pagina[EquipoInventario])
def listar(
    buscar: str | None = Query(None, description="Nombre o código, coincidencia parcial"),
    id_categoria: int | None = Query(None),
    id_estado_equipo: int | None = Query(None, ge=1, le=4,
                                         description="1 Disponible, 2 Prestado, 3 En mantenimiento, 4 Dado de baja"),
    pagina: int = Query(1, ge=1),
    db: Session = Depends(obtener_sesion),
):
    """Tabla paginada de 20 equipos por página (SRS 8.8)."""
    return servicio.listar_inventario(db, buscar, id_categoria, id_estado_equipo, pagina, EQUIPOS_POR_PAGINA)


@router.get("/{codigo}", response_model=EquipoInventario)
def obtener(codigo: str, db: Session = Depends(obtener_sesion)):
    return servicio.a_inventario(servicio.obtener_equipo(db, codigo))


@router.post("", response_model=EquipoInventario, status_code=status.HTTP_201_CREATED)
def dar_de_alta(datos: EquipoCrear, db: Session = Depends(obtener_sesion)):
    """Alta de equipo. El código (ej. OSC-004) se genera automáticamente.

    La foto y el manual se suben después con PUT .../foto y PUT .../manual.
    """
    return servicio.a_inventario(servicio.crear_equipo(db, datos))


@router.put("/{codigo}", response_model=EquipoInventario)
def editar(codigo: str, datos: EquipoActualizar, db: Session = Depends(obtener_sesion)):
    """Edita los datos del equipo. El código y la categoría no cambian."""
    return servicio.a_inventario(servicio.actualizar_equipo(db, codigo, datos))


@router.patch("/{codigo}/estado", response_model=EquipoInventario)
def cambiar_estado(codigo: str, datos: CambioEstadoEquipo, db: Session = Depends(obtener_sesion)):
    """Mandar a mantenimiento o regresar a disponible."""
    return servicio.a_inventario(servicio.cambiar_estado(db, codigo, datos.estado))


@router.post("/{codigo}/baja", response_model=EquipoInventario)
def dar_de_baja(codigo: str, datos: BajaEquipo, db: Session = Depends(obtener_sesion)):
    """Baja lógica con motivo. Se bloquea si el equipo está en un préstamo activo."""
    return servicio.a_inventario(servicio.dar_de_baja(db, codigo, datos.motivo))


@router.delete("/{codigo}", response_model=Mensaje)
def eliminar(codigo: str, db: Session = Depends(obtener_sesion)):
    """Borrado definitivo, solo si el equipo nunca estuvo en un préstamo."""
    servicio.eliminar_equipo(db, codigo)
    return Mensaje(mensaje="Equipo eliminado")


@router.put("/{codigo}/foto", response_model=EquipoInventario)
def subir_foto(codigo: str, archivo: UploadFile = File(..., description="JPG, PNG o WebP, máximo 5 MB"),
               db: Session = Depends(obtener_sesion)):
    return servicio.a_inventario(servicio.subir_foto(db, codigo, archivo))


@router.put("/{codigo}/manual", response_model=EquipoInventario)
def subir_manual(codigo: str, archivo: UploadFile = File(..., description="PDF, máximo 10 MB"),
                 db: Session = Depends(obtener_sesion)):
    return servicio.a_inventario(servicio.subir_manual(db, codigo, archivo))
