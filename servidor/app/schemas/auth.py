"""Formato de los datos JSON que entran y salen del módulo de autenticación."""
from pydantic import BaseModel, field_validator, model_validator

from app.core.constantes import LONGITUD_MINIMA_CONTRASENA_ESTUDIANTE
from app.core.validaciones import (
    DOMINIOS_ALUMNO,
    normalizar_correo,
    validar_boleta,
    validar_contrasena,
    validar_correo_dominio,
    validar_nombre,
)


# ------------------------------------------------------------------ entrada

class RegistroEstudiante(BaseModel):
    """SRS 2: nombre completo, correo, boleta y contraseña."""
    nombre: str
    apellido_pat: str
    apellido_mat: str | None = None
    boleta: str
    correo: str
    contrasena: str

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
        if v is None or not v.strip():
            return None
        return validar_nombre(v, "El apellido materno")

    @field_validator("boleta")
    @classmethod
    def _boleta(cls, v: str) -> str:
        return validar_boleta(v)

    @field_validator("correo")
    @classmethod
    def _correo(cls, v: str) -> str:
        return validar_correo_dominio(v, DOMINIOS_ALUMNO)

    @field_validator("contrasena")
    @classmethod
    def _contrasena(cls, v: str) -> str:
        return validar_contrasena(v, LONGITUD_MINIMA_CONTRASENA_ESTUDIANTE)


class SolicitudLogin(BaseModel):
    """SRS 1: estudiante entra con su boleta, encargado con su correo."""
    usuario: str
    contrasena: str


class CambioContrasena(BaseModel):
    """SRS 1.4: contraseña actual + nueva + confirmación."""
    contrasena_actual: str
    contrasena_nueva: str
    confirmacion: str

    @model_validator(mode="after")
    def _coinciden(self):
        if self.contrasena_nueva != self.confirmacion:
            raise ValueError("La nueva contraseña y su confirmación no coinciden")
        return self


class VerificarCorreo(BaseModel):
    """SRS 1.3, paso 1: el usuario escribe su correo."""
    correo: str

    @field_validator("correo")
    @classmethod
    def _correo(cls, v: str) -> str:
        return normalizar_correo(v)


class RestablecerContrasena(BaseModel):
    """SRS 1.3, paso 2: el usuario genera su nueva contraseña."""
    correo: str
    contrasena_nueva: str
    confirmacion: str

    @field_validator("correo")
    @classmethod
    def _correo(cls, v: str) -> str:
        return normalizar_correo(v)

    @model_validator(mode="after")
    def _coinciden(self):
        if self.contrasena_nueva != self.confirmacion:
            raise ValueError("La nueva contraseña y su confirmación no coinciden")
        return self


# ------------------------------------------------------------------ salida

class Mensaje(BaseModel):
    mensaje: str


class EstudianteRegistrado(BaseModel):
    id_estudiante: int
    boleta: str
    nombre_completo: str
    correo: str


class RespuestaLogin(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_en_minutos: int
    rol: str                  # "estudiante" o "encargado"
    nombre: str               # para la barra superior (SRS 1.1)
    ruta_inicio: str          # a dónde redirigir (SRS 1.2)
    cuenta_suspendida: bool   # alumno con bloqueo por adeudos: entra, pero no puede solicitar


class PerfilUsuario(BaseModel):
    id: int
    rol: str
    nombre: str
    apellido_pat: str
    apellido_mat: str | None
    nombre_completo: str
    correo: str
    boleta: str | None
    cuenta_suspendida: bool
