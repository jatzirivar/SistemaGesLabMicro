"""Reglas de validación reutilizables. Lanzan ValueError con mensajes en español."""
import re


_PATRON_NOMBRE = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$")
_PATRON_BOLETA = re.compile(r"^[0-9]{10}$")
_PATRON_CORREO = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

# bcrypt solo usa los primeros 72 bytes de la contraseña
_BYTES_MAXIMOS_BCRYPT = 72


def validar_nombre(valor: str, campo: str = "El nombre") -> str:
    valor = " ".join(valor.split())  # quita espacios dobles y en los extremos
    if not valor:
        raise ValueError(f"{campo} es obligatorio")
    if len(valor) > 60:
        raise ValueError(f"{campo} no puede tener más de 60 caracteres")
    if not _PATRON_NOMBRE.match(valor):
        raise ValueError(f"{campo} solo puede contener letras y espacios")
    return valor


def validar_boleta(valor: str) -> str:
    valor = valor.strip()
    if not _PATRON_BOLETA.match(valor):
        raise ValueError("La boleta debe tener exactamente 10 dígitos")
    return valor


def normalizar_correo(valor: str) -> str:
    return valor.strip().lower()


def validar_formato_correo(valor: str) -> str:
    valor = normalizar_correo(valor)
    if len(valor) > 120 or not _PATRON_CORREO.match(valor):
        raise ValueError("El correo electrónico no tiene un formato válido")
    return valor


def validar_contrasena(valor: str, longitud_minima: int) -> str:
    """Reglas del SRS 2: mínimo de caracteres, mayúscula, minúscula, número y sin espacios."""
    if len(valor) < longitud_minima:
        raise ValueError(f"La contraseña debe tener al menos {longitud_minima} caracteres")
    if any(c.isspace() for c in valor):
        raise ValueError("La contraseña no debe contener espacios en blanco")
    if not any(c.isupper() for c in valor):
        raise ValueError("La contraseña debe contener al menos una letra mayúscula")
    if not any(c.islower() for c in valor):
        raise ValueError("La contraseña debe contener al menos una letra minúscula")
    if not any(c.isdigit() for c in valor):
        raise ValueError("La contraseña debe contener al menos un número")
    if len(valor.encode("utf-8")) > _BYTES_MAXIMOS_BCRYPT:
        raise ValueError("La contraseña es demasiado larga")
    return valor
