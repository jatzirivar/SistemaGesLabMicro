"""Catálogo de equipos para el estudiante: /api/catalogo (SRS 4 y 4.1)."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import obtener_usuario_actual
from app.schemas.inventario import EquipoCatalogo, EquipoDetalle, Pagina
from app.services import inventario_servicio

# Cualquier usuario con sesión puede consultar el catálogo
router = APIRouter(
    prefix="/api/catalogo",
    tags=["Catálogo"],
    dependencies=[Depends(obtener_usuario_actual)],
)


@router.get("", response_model=Pagina[EquipoCatalogo])
def listar(
    buscar: str | None = Query(None, description="Nombre o código, coincidencia parcial"),
    id_categoria: int | None = Query(None),
    disponibilidad: Literal["Disponible", "No disponible"] | None = Query(None),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    db: Session = Depends(obtener_sesion),
):
    """Equipos (sin los dados de baja) con su disponibilidad en este momento.

    `se_puede_agregar` indica si el botón "Agregar al carrito" va habilitado.
    """
    return inventario_servicio.listar_catalogo(db, buscar, id_categoria, disponibilidad, pagina, por_pagina)


@router.get("/{codigo}", response_model=EquipoDetalle)
def detalle(codigo: str, db: Session = Depends(obtener_sesion)):
    """Ficha completa de un equipo: descripción, especificaciones, componentes y manual."""
    return inventario_servicio.detalle_catalogo(db, codigo)
