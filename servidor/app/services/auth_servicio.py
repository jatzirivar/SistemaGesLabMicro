"""Reglas de negocio de autenticación (SRS 1 a 1.5 y 2)."""
import math
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import configuracion
from app.core.constantes import (
    INTENTOS_MAXIMOS_LOGIN,
    LONGITUD_MINIMA_CONTRASENA_ENCARGADO,
    LONGITUD_MINIMA_CONTRASENA_ESTUDIANTE,
    MENSAJE_CORREO_NO_REGISTRADO,
    MENSAJE_CREDENCIALES_INVALIDAS,
    MINUTOS_BLOQUEO_LOGIN,
    EstadoCuenta,
    Rol,
)
from app.core.dependencias import UsuarioSesion
from app.core.seguridad import crear_token, generar_hash, simular_verificacion, verificar_contrasena
from app.core.validaciones import dominio_autorizado, validar_contrasena
from app.models.usuarios import Encargado, Estudiante
from app.schemas.auth import RegistroEstudiante

RUTA_INICIO = {
    Rol.ESTUDIANTE: "/estudiante/panel",   # Panel Principal (SRS 1.2)
    Rol.ENCARGADO: "/encargado/panel",     # Panel Operativo (SRS 1.2)
}


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _longitud_minima(rol: str) -> int:
    if rol == Rol.ENCARGADO:
        return LONGITUD_MINIMA_CONTRASENA_ENCARGADO
    return LONGITUD_MINIMA_CONTRASENA_ESTUDIANTE


def _validar_nueva_contrasena(valor: str, rol: str) -> None:
    try:
        validar_contrasena(valor, _longitud_minima(rol))
    except ValueError as error:
        raise HTTPException(422, str(error))


def _credenciales_invalidas() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, MENSAJE_CREDENCIALES_INVALIDAS)


def _cuenta_bloqueada(hasta: datetime) -> HTTPException:
    minutos = max(1, math.ceil((hasta - _ahora()).total_seconds() / 60))
    return HTTPException(
        status.HTTP_423_LOCKED,
        f"Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en {minutos} minuto(s).",
    )


# =================================================================== registro

def registrar_estudiante(db: Session, datos: RegistroEstudiante) -> Estudiante:
    if db.scalar(select(Estudiante.id_estudiante).where(Estudiante.boleta == datos.boleta)):
        raise HTTPException(status.HTTP_409_CONFLICT, "La boleta ya está registrada")
    if db.scalar(select(Estudiante.id_estudiante).where(func.lower(Estudiante.correo) == datos.correo)):
        raise HTTPException(status.HTTP_409_CONFLICT, "El correo ya está registrado")

    estudiante = Estudiante(
        boleta=datos.boleta,
        nombre=datos.nombre,
        apellido_pat=datos.apellido_pat,
        apellido_mat=datos.apellido_mat,
        correo=datos.correo,
        contrasena_hash=generar_hash(datos.contrasena),
        intentos_fallidos=0,
        id_estado_cuenta=EstadoCuenta.ACTIVA,
    )
    db.add(estudiante)
    try:
        db.commit()
    except IntegrityError:
        # Dos registros con la misma boleta/correo al mismo tiempo
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "La boleta o el correo ya están registrados")
    db.refresh(estudiante)
    return estudiante


# =================================================================== login

def iniciar_sesion(db: Session, usuario: str, contrasena: str) -> dict:
    usuario = usuario.strip()

    # El correo identifica al encargado; la boleta, al estudiante (SRS 1)
    if "@" in usuario:
        rol = Rol.ENCARGADO
        consulta = select(Encargado).where(func.lower(Encargado.correo) == usuario.lower())
    else:
        rol = Rol.ESTUDIANTE
        consulta = select(Estudiante).where(Estudiante.boleta == usuario)

    # FOR UPDATE: si llegan dos intentos al mismo tiempo, se cuentan bien
    cuenta = db.scalar(consulta.with_for_update())

    if cuenta is None or not usuario or not contrasena:
        simular_verificacion()
        raise _credenciales_invalidas()

    ahora = _ahora()

    # ¿Sigue bloqueada por intentos fallidos? (SRS 1.1)
    if cuenta.id_estado_cuenta == EstadoCuenta.BLOQUEADA:
        if cuenta.bloqueado_hasta and cuenta.bloqueado_hasta > ahora:
            raise _cuenta_bloqueada(cuenta.bloqueado_hasta)
        # El bloqueo ya terminó
        cuenta.id_estado_cuenta = EstadoCuenta.ACTIVA
        cuenta.intentos_fallidos = 0
        cuenta.bloqueado_hasta = None

    if not verificar_contrasena(contrasena, cuenta.contrasena_hash):
        cuenta.intentos_fallidos += 1
        if cuenta.intentos_fallidos >= INTENTOS_MAXIMOS_LOGIN:
            cuenta.id_estado_cuenta = EstadoCuenta.BLOQUEADA
            cuenta.bloqueado_hasta = ahora + timedelta(minutes=MINUTOS_BLOQUEO_LOGIN)
            cuenta.intentos_fallidos = 0
            db.commit()
            raise _cuenta_bloqueada(cuenta.bloqueado_hasta)
        db.commit()
        raise _credenciales_invalidas()

    # Contraseña correcta: se reinicia el contador
    cuenta.intentos_fallidos = 0
    cuenta.bloqueado_hasta = None
    db.commit()

    # Un encargado desactivado no entra. Un estudiante suspendido por adeudos
    # sí entra (para ver su alerta), pero no podrá enviar solicitudes (SRS 8.13).
    suspendida = cuenta.id_estado_cuenta == EstadoCuenta.SUSPENDIDA
    if rol == Rol.ENCARGADO and suspendida:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu cuenta está desactivada")

    return {
        "access_token": crear_token(cuenta.id, rol),
        "token_type": "bearer",
        "expira_en_minutos": configuracion.jwt_minutos,
        "rol": rol,
        "nombre": cuenta.nombre_completo,
        "ruta_inicio": RUTA_INICIO[rol],
        "cuenta_suspendida": suspendida,
    }


# =================================================================== perfil

def perfil(usuario: UsuarioSesion) -> dict:
    cuenta = usuario.cuenta
    return {
        "id": usuario.id,
        "rol": usuario.rol,
        "nombre": cuenta.nombre,
        "apellido_pat": cuenta.apellido_pat,
        "apellido_mat": cuenta.apellido_mat,
        "nombre_completo": cuenta.nombre_completo,
        "correo": cuenta.correo,
        "boleta": getattr(cuenta, "boleta", None),
        "cuenta_suspendida": usuario.suspendida,
    }


# =================================================================== cambio voluntario (SRS 1.4)

def cambiar_contrasena(db: Session, usuario: UsuarioSesion, actual: str, nueva: str) -> None:
    cuenta = usuario.cuenta
    if not verificar_contrasena(actual, cuenta.contrasena_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual es incorrecta")
    if actual == nueva:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La nueva contraseña debe ser diferente a la actual")
    _validar_nueva_contrasena(nueva, usuario.rol)

    cuenta.contrasena_hash = generar_hash(nueva)
    db.commit()


# =================================================================== restablecimiento (SRS 1.3)
# Se implementa tal como lo indica el SRS: si el correo tiene dominio autorizado
# y está registrado, el usuario puede generar una nueva contraseña.

def _buscar_por_correo(db: Session, correo: str) -> tuple[str, Estudiante | Encargado]:
    if dominio_autorizado(correo):
        estudiante = db.scalar(select(Estudiante).where(func.lower(Estudiante.correo) == correo))
        if estudiante:
            return Rol.ESTUDIANTE, estudiante
        encargado = db.scalar(select(Encargado).where(func.lower(Encargado.correo) == correo))
        if encargado:
            return Rol.ENCARGADO, encargado
    raise HTTPException(status.HTTP_404_NOT_FOUND, MENSAJE_CORREO_NO_REGISTRADO)


def verificar_correo(db: Session, correo: str) -> None:
    _buscar_por_correo(db, correo)


def restablecer_contrasena(db: Session, correo: str, nueva: str) -> None:
    rol, cuenta = _buscar_por_correo(db, correo)
    _validar_nueva_contrasena(nueva, rol)
    cuenta.contrasena_hash = generar_hash(nueva)
    db.commit()
