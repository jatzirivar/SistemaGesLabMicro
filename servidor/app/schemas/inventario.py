"""Datos JSON del catálogo, el inventario y las categorías."""
import re
from datetime import date
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, field_validator

T = TypeVar("T")


def _texto(valor: str, campo: str, minimo: int, maximo: int | None) -> str:
    valor = valor.strip()
    if len(valor) < minimo:
        raise ValueError(f"{campo} debe tener al menos {minimo} caracteres" if minimo > 1
                         else f"{campo} es obligatorio")
    if maximo and len(valor) > maximo:
        raise ValueError(f"{campo} no puede tener más de {maximo} caracteres")
    return valor


def _prefijo(valor: str) -> str:
    valor = valor.strip().upper()
    if not re.fullmatch(r"[A-Z]{3,4}", valor):
        raise ValueError("El prefijo debe tener 3 o 4 letras (ej. OSC, FUEN)")
    return valor


# ================================================================ genérico

class Pagina(BaseModel, Generic[T]):
    elementos: list[T]
    total: int
    pagina: int
    por_pagina: int
    total_paginas: int


# ================================================================ categorías

class CategoriaCrear(BaseModel):
    nombre: str
    prefijo: str

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        return _texto(v, "El nombre", 1, 60)

    @field_validator("prefijo")
    @classmethod
    def _prefijo(cls, v: str) -> str:
        return _prefijo(v)


class CategoriaActualizar(BaseModel):
    nombre: str
    prefijo: str | None = None   # solo se puede cambiar si la categoría aún no tiene equipos

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        return _texto(v, "El nombre", 1, 60)

    @field_validator("prefijo")
    @classmethod
    def _prefijo(cls, v: str | None) -> str | None:
        return _prefijo(v) if v else None


class CategoriaRespuesta(BaseModel):
    id_categoria: int
    nombre: str
    prefijo: str
    total_equipos: int     # sin contar los dados de baja
    disponibles: int       # en estado "Disponible"


# ================================================================ equipos (entrada)

class EquipoDatos(BaseModel):
    """Campos editables de un equipo (SRS 8.10)."""
    nombre: str
    descripcion: str
    especificaciones: str
    componentes_incluidos: str
    fecha_adquisicion: date

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        return _texto(v, "El nombre", 1, 100)

    @field_validator("descripcion")
    @classmethod
    def _descripcion(cls, v: str) -> str:
        return _texto(v, "La descripción", 1, 2000)

    @field_validator("especificaciones")
    @classmethod
    def _especificaciones(cls, v: str) -> str:
        return _texto(v, "Las especificaciones", 1, 2000)

    @field_validator("componentes_incluidos")
    @classmethod
    def _componentes(cls, v: str) -> str:
        return _texto(v, "La lista de componentes", 1, 2000)

    @field_validator("fecha_adquisicion")
    @classmethod
    def _fecha(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("La fecha de adquisición no puede ser futura")
        return v


class EquipoCrear(EquipoDatos):
    id_categoria: int


class EquipoActualizar(EquipoDatos):
    """La edición no permite cambiar el código ni la categoría (SRS 8.10)."""


class CambioEstadoEquipo(BaseModel):
    estado: Literal["Disponible", "En mantenimiento"]


class BajaEquipo(BaseModel):
    motivo: str

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, v: str) -> str:
        return _texto(v, "El motivo de baja", 5, 255)


# ================================================================ equipos (salida)

class EquipoCatalogo(BaseModel):
    """Tarjeta del catálogo del estudiante (SRS 4 y 4.1)."""
    codigo_inventario: str
    nombre: str
    id_categoria: int
    categoria: str
    disponibilidad: str        # "Disponible" | "En mantenimiento"
    ocupado_ahora: bool        # un préstamo aprobado lo tiene ahora: "Ocupado ahora, disponible en otros horarios"
    se_puede_agregar: bool     # habilita o deshabilita el botón "Agregar"
    foto_url: str | None


class EquipoDetalle(EquipoCatalogo):
    descripcion: str
    especificaciones: str
    componentes_incluidos: str
    manual_url: str | None


class EquipoInventario(BaseModel):
    """Fila de la tabla de inventario del encargado (SRS 8.8)."""
    codigo_inventario: str
    nombre: str
    id_categoria: int
    categoria: str
    id_estado_equipo: int
    estado: str
    fecha_adquisicion: date
    descripcion: str
    especificaciones: str
    componentes_incluidos: str
    foto_url: str | None
    manual_url: str | None
    motivo_baja: str | None
    fecha_baja: date | None
