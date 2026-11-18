"""Fecha y hora del laboratorio (zona America/Mexico_City)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import configuracion

ZONA = ZoneInfo(configuracion.zona_horaria)


def ahora() -> datetime:
    """Fecha y hora actual con zona horaria del laboratorio."""
    return datetime.now(ZONA)


def hoy() -> date:
    return ahora().date()


def a_local(valor: datetime | None) -> datetime | None:
    """Convierte cualquier fecha con zona a la hora del laboratorio."""
    return valor.astimezone(ZONA) if valor else None
