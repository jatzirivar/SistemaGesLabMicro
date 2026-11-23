"""Dependencias para proteger rutas: quién hace la petición y con qué rol.

Uso en una ruta:
    def mi_ruta(usuario: UsuarioSesion = Depends(requerir_encargado)): ...
"""
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.constantes import EstadoCuenta, Rol
from app.core.database import obtener_sesion
from app.core.seguridad import decodificar_token
from app.models.usuarios import Encargado, Estudiante

_esquema_bearer = HTTPBearer(auto_error=False, description="Pega aquí el token que devuelve /api/auth/login")


@dataclass
class UsuarioSesion:
    id: int
    rol: str
    cuenta: Estudiante | Encargado

    @property
    def suspendida(self) -> bool:
        return self.cuenta.id_estado_cuenta == EstadoCuenta.SUSPENDIDA


def _no_autenticado(mensaje: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=mensaje,
        headers={"WWW-Authenticate": "Bearer"},
    )


def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_esquema_bearer),
    db: Session = Depends(obtener_sesion),
) -> UsuarioSesion:
    if credenciales is None:
        raise _no_autenticado("Debes iniciar sesión")

    try:
        datos = decodificar_token(credenciales.credentials)
        id_usuario = int(datos["sub"])
        rol = datos["rol"]
    except jwt.ExpiredSignatureError:
        raise _no_autenticado("Tu sesión expiró, inicia sesión de nuevo")
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _no_autenticado("Sesión inválida, inicia sesión de nuevo")

    modelo = {Rol.ESTUDIANTE: Estudiante, Rol.ENCARGADO: Encargado}.get(rol)
    cuenta = db.get(modelo, id_usuario) if modelo else None
    if cuenta is None:
        raise _no_autenticado("Sesión inválida, inicia sesión de nuevo")

    # Un encargado desactivado pierde el acceso aunque tenga un token vigente
    if rol == Rol.ENCARGADO and cuenta.id_estado_cuenta == EstadoCuenta.SUSPENDIDA:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu cuenta está desactivada")

    return UsuarioSesion(id=id_usuario, rol=rol, cuenta=cuenta)


def requerir_estudiante(usuario: UsuarioSesion = Depends(obtener_usuario_actual)) -> UsuarioSesion:
    if usuario.rol != Rol.ESTUDIANTE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta acción es solo para estudiantes")
    return usuario


def requerir_encargado(usuario: UsuarioSesion = Depends(obtener_usuario_actual)) -> UsuarioSesion:
    if usuario.rol != Rol.ENCARGADO:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta acción es solo para el encargado del laboratorio")
    return usuario
