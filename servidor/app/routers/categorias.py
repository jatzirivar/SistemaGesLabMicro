"""Categorías de equipo: /api/categorias (SRS 8.12)."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import obtener_usuario_actual, requerir_encargado
from app.schemas.auth import Mensaje
from app.schemas.inventario import CategoriaActualizar, CategoriaCrear, CategoriaRespuesta
from app.services import inventario_servicio

router = APIRouter(prefix="/api/categorias", tags=["Categorías"])


@router.get("", response_model=list[CategoriaRespuesta], dependencies=[Depends(obtener_usuario_actual)])
def listar(db: Session = Depends(obtener_sesion)):
    """Todas las categorías, con cuántos equipos tienen y cuántos están disponibles."""
    return inventario_servicio.listar_categorias(db)


@router.post("", response_model=CategoriaRespuesta, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(requerir_encargado)])
def crear(datos: CategoriaCrear, db: Session = Depends(obtener_sesion)):
    return inventario_servicio.crear_categoria(db, datos)


@router.put("/{id_categoria}", response_model=CategoriaRespuesta, dependencies=[Depends(requerir_encargado)])
def renombrar(id_categoria: int, datos: CategoriaActualizar, db: Session = Depends(obtener_sesion)):
    """Cambia el nombre. El prefijo solo se puede cambiar si aún no tiene equipos."""
    return inventario_servicio.actualizar_categoria(db, id_categoria, datos)


@router.delete("/{id_categoria}", response_model=Mensaje, dependencies=[Depends(requerir_encargado)])
def eliminar(id_categoria: int, db: Session = Depends(obtener_sesion)):
    """Se bloquea si la categoría tiene equipos registrados."""
    inventario_servicio.eliminar_categoria(db, id_categoria)
    return Mensaje(mensaje="Categoría eliminada")
