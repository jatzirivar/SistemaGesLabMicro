"""Hash de contraseñas (bcrypt) y tokens de sesión (JWT)."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import configuracion

ALGORITMO_JWT = "HS256"


# ---------------------------------------------------------------- contraseñas

def generar_hash(contrasena: str) -> str:
    """Devuelve el hash bcrypt (incluye su sal) listo para guardar en la BD."""
    return bcrypt.hashpw(contrasena.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verificar_contrasena(contrasena: str, hash_guardado: str) -> bool:
    datos = contrasena.encode("utf-8")
    if len(datos) > 72:
        return False
    try:
        return bcrypt.checkpw(datos, hash_guardado.encode("utf-8"))
    except ValueError:  # hash con formato inválido en la BD
        return False


# Se usa cuando el usuario no existe, para que la respuesta tarde lo mismo
# y no se pueda adivinar qué boletas o correos están registrados.
_HASH_SIMULADO = generar_hash("SimulacionDeTiempo2026")


def simular_verificacion() -> None:
    bcrypt.checkpw(b"SimulacionDeTiempo2026x", _HASH_SIMULADO.encode("utf-8"))


# ---------------------------------------------------------------- tokens JWT

def crear_token(id_usuario: int, rol: str) -> str:
    ahora = datetime.now(timezone.utc)
    datos = {
        "sub": str(id_usuario),
        "rol": rol,
        "iat": ahora,
        "exp": ahora + timedelta(minutes=configuracion.jwt_minutos),
    }
    return jwt.encode(datos, configuracion.jwt_secreto, algorithm=ALGORITMO_JWT)


def decodificar_token(token: str) -> dict:
    """Lanza jwt.ExpiredSignatureError o jwt.InvalidTokenError si no es válido."""
    return jwt.decode(token, configuracion.jwt_secreto, algorithms=[ALGORITMO_JWT])
