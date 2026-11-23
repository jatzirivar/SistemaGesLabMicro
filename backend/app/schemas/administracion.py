"""Datos JSON de administración: alumnos, encargados, configuración e historial (SRS 8.13 a 8.15)."""
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

from app.core.constantes import LONGITUD_MINIMA_CONTRASENA_ENCARGADO
from app.core.validaciones import (
    DOMINIOS_ALUMNO,
    DOMINIOS_ENCARGADO,
    validar_boleta,
    validar_contrasena,
    validar_correo_dominio,
    validar_nombre,
)
from app.schemas.prestamos import EquipoEnPrestamo, ResumenPrestamo
from app.schemas.ventanilla import IncidenciaRespuesta, SancionRespuesta


class _Nombres(BaseModel):
    nombre: str
    apellido_pat: str
    apellido_mat: str | None = None

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, v: str) -> str:
        return validar_nombre(v, "El nombre")

    @field_validator("apellido_pat")
    @classmethod
    def _apellido_pat(cls, v: str) -> str:
        return validar_nombre(v, "El apellido paterno")

    @field_validator("apellido_mat")
    @classmethod
    def _apellido_mat(cls, v: str | None) -> str | None:
        return validar_nombre(v, "El apellido materno") if v and v.strip() else None


# ================================================================ alumnos (SRS 8.13)


class RegistroAlumnoManual(_Nombres):
    """Registro manual: nombre completo, boleta de 10 dígitos y correo (cualquier dominio)."""
    boleta: str
    correo: str

    @field_validator("boleta")
    @classmethod
    def _boleta(cls, v: str) -> str:
        return validar_boleta(v)

    @field_validator("correo")
    @classmethod
    def _correo(cls, v: str) -> str:
        return validar_correo_dominio(v, DOMINIOS_ALUMNO)


class CambioSuspension(BaseModel):
    """Bloquear (suspender) o desbloquear el envío de solicitudes por adeudos."""
    suspender: bool
    motivo: str | None = None

    @model_validator(mode="after")
    def _motivo(self):
        texto = (self.motivo or "").strip()
        if self.suspender and len(texto) < 5:
            raise ValueError("Escribe el motivo de la suspensión (mínimo 5 caracteres)")
        if len(texto) > 255:
            raise ValueError("El motivo no puede tener más de 255 caracteres")
        self.motivo = texto or None
        return self


class AlumnoResumen(BaseModel):
    id_estudiante: int
    boleta: str
    nombre_completo: str
    correo: str
    estado_cuenta: str              # Activa / Suspendida / Bloqueada
    suspendido: bool                # bloqueo manual por adeudos
    bloqueado_temporalmente: bool   # 15 min por intentos fallidos
    sanciones_vigentes: int
    prestamos_activos: int
    tiene_adeudos: bool


class AlumnoRegistrado(BaseModel):
    alumno: AlumnoResumen
    mensaje: str          # indica al encargado que el alumno cree su contraseña con "¿Olvidaste tu contraseña?"


class AlumnoDetalle(BaseModel):
    """Historial de préstamos e incidencias del alumno (SRS 8.13)."""
    alumno: AlumnoResumen
    prestamos: list[ResumenPrestamo]
    incidencias: list[IncidenciaRespuesta]
    sanciones: list[SancionRespuesta]


# ================================================================ encargados


class RegistroEncargado(_Nombres):
    correo: str
    contrasena: str

    @field_validator("correo")
    @classmethod
    def _correo(cls, v: str) -> str:
        return validar_correo_dominio(v, DOMINIOS_ENCARGADO)

    @field_validator("contrasena")
    @classmethod
    def _contrasena(cls, v: str) -> str:
        return validar_contrasena(v, LONGITUD_MINIMA_CONTRASENA_ENCARGADO)


class EncargadoRespuesta(BaseModel):
    id_encargado: int
    nombre_completo: str
    correo: str
    estado_cuenta: str


# ================================================================ configuración (SRS 8.14)


class DuracionSancion(BaseModel):
    tipo: str
    dias: int | None                # None = indefinida


class ConfiguracionRespuesta(BaseModel):
    horario_apertura: time          # primera hora de retiro
    horario_cierre: time            # última hora de retiro
    hora_limite_devolucion: time    # última hora para devolver
    dias_servicio: list[str]        # lunes a viernes
    duracion_ordinaria: int         # minutos
    duracion_prorroga: int          # minutos
    duracion_maxima: int            # minutos
    limite_equipos: int
    limite_por_modelo: int
    tolerancia_retiro: int          # minutos
    duraciones_sancion: list[DuracionSancion]   # SRS 8.14: "las del 14.0", solo lectura


class ConfiguracionActualizar(BaseModel):
    """Parámetros editables que enumera el SRS 8.14."""
    horario_apertura: time
    horario_cierre: time
    hora_limite_devolucion: time
    duracion_maxima: int            # minutos
    limite_equipos: int
    tolerancia_retiro: int          # minutos

    @model_validator(mode="after")
    def _coherencia(self):
        if not self.horario_apertura < self.horario_cierre:
            raise ValueError("La primera hora de retiro debe ser anterior a la última")
        if not self.horario_cierre <= self.hora_limite_devolucion:
            raise ValueError("La hora límite de devolución no puede ser anterior a la última hora de retiro")
        if not 60 <= self.duracion_maxima <= 720:
            raise ValueError("La duración máxima debe estar entre 60 y 720 minutos")
        if not 1 <= self.limite_equipos <= 20:
            raise ValueError("El límite de equipos debe estar entre 1 y 20")
        if not 0 <= self.tolerancia_retiro <= 120:
            raise ValueError("La tolerancia de retiro debe estar entre 0 y 120 minutos")
        return self


class DiaInhabilCrear(BaseModel):
    fecha: date
    descripcion: str

    @field_validator("descripcion")
    @classmethod
    def _descripcion(cls, v: str) -> str:
        v = v.strip()
        if not 3 <= len(v) <= 100:
            raise ValueError("La descripción debe tener entre 3 y 100 caracteres")
        return v


class DiaInhabilRespuesta(BaseModel):
    fecha: date
    descripcion: str


class ResultadoDiaInhabil(BaseModel):
    dia: DiaInhabilRespuesta
    solicitudes_afectadas: list[str]   # folios Pendiente/Aprobada con retiro ese día
    mensaje: str


# ================================================================ historial (SRS 8.15)

# Estados que lista el SRS 8.15
EstadoFiltro = Literal["Aprobada", "Entregada", "Vencida", "Devuelta", "Cancelada", "Rechazada"]


class FilaHistorial(BaseModel):
    folio: str
    estado: str
    estudiante: str
    boleta: str
    grupo: str
    equipos: list[EquipoEnPrestamo]
    fecha_hora_prog_retiro: datetime
    fecha_hora_limite_devolucion: datetime
    fecha_hora_real_entrega: datetime | None
    fecha_hora_real_devolucion: datetime | None
    incidencias: int
