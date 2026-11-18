"""Rutas del módulo de Autenticación y Seguridad: /api/auth/..."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import UsuarioSesion, obtener_usuario_actual
from app.schemas.auth import (
    CambioContrasena,
    EstudianteRegistrado,
    Mensaje,
    PerfilUsuario,
    RegistroEstudiante,
    RespuestaLogin,
    RestablecerContrasena,
    SolicitudLogin,
    VerificarCorreo,
)
from app.services import auth_servicio

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


@router.post("/registro", response_model=EstudianteRegistrado, status_code=status.HTTP_201_CREATED)
def registrar(datos: RegistroEstudiante, db: Session = Depends(obtener_sesion)):
    """Crea la cuenta de un estudiante (SRS 2)."""
    estudiante = auth_servicio.registrar_estudiante(db, datos)
    return EstudianteRegistrado(
        id_estudiante=estudiante.id_estudiante,
        boleta=estudiante.boleta,
        nombre_completo=estudiante.nombre_completo,
        correo=estudiante.correo,
    )


@router.post("/login", response_model=RespuestaLogin)
def iniciar_sesion(datos: SolicitudLogin, db: Session = Depends(obtener_sesion)):
    """Estudiante: boleta + contraseña. Encargado: correo + contraseña (SRS 1).

    - 401: "Usuario o contraseña incorrectos" (SRS 1.2)
    - 423: cuenta bloqueada 15 min tras 5 intentos fallidos (SRS 1.1)
    """
    return auth_servicio.iniciar_sesion(db, datos.usuario, datos.contrasena)


@router.get("/yo", response_model=PerfilUsuario)
def mi_perfil(usuario: UsuarioSesion = Depends(obtener_usuario_actual)):
    """Datos del usuario con sesión iniciada (nombre para la barra superior, rol...)."""
    return auth_servicio.perfil(usuario)


@router.put("/contrasena", response_model=Mensaje)
def cambiar_contrasena(
    datos: CambioContrasena,
    usuario: UsuarioSesion = Depends(obtener_usuario_actual),
    db: Session = Depends(obtener_sesion),
):
    """Cambio voluntario de contraseña desde el perfil (SRS 1.4)."""
    auth_servicio.cambiar_contrasena(db, usuario, datos.contrasena_actual, datos.contrasena_nueva)
    return Mensaje(mensaje="Contraseña actualizada correctamente")


@router.post("/restablecer/verificar", response_model=Mensaje)
def verificar_correo(datos: VerificarCorreo, db: Session = Depends(obtener_sesion)):
    """Paso 1 del restablecimiento: valida que el correo esté registrado (SRS 1.3).

    - 404: "Correo no registrado"
    """
    auth_servicio.verificar_correo(db, datos.correo)
    return Mensaje(mensaje="Correo verificado. Ingresa tu nueva contraseña.")


@router.post("/restablecer", response_model=Mensaje)
def restablecer_contrasena(datos: RestablecerContrasena, db: Session = Depends(obtener_sesion)):
    """Paso 2 del restablecimiento: guarda la nueva contraseña (SRS 1.3)."""
    auth_servicio.restablecer_contrasena(db, datos.correo, datos.contrasena_nueva)
    return Mensaje(mensaje="Contraseña restablecida. Ya puedes iniciar sesión.")
