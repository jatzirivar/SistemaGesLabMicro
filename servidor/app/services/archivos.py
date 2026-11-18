"""Guarda fotos y manuales de equipos en la carpeta uploads/.

En la BD solo se guarda la ruta relativa (ej. "equipos/OSC-001_a1b2c3.jpg").
El navegador los descarga en /uploads/<ruta>.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.constantes import TAMANO_MAXIMO_FOTO, TAMANO_MAXIMO_MANUAL

CARPETA_UPLOADS = Path("uploads")
CARPETA_EQUIPOS = CARPETA_UPLOADS / "equipos"


def _tipo_imagen(datos: bytes) -> str | None:
    """Reconoce el formato por su contenido, no por la extensión del nombre."""
    if datos.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if datos.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "webp"
    return None


def _leer_con_limite(archivo: UploadFile, limite: int, nombre_limite: str) -> bytes:
    datos = archivo.file.read(limite + 1)
    if not datos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El archivo está vacío")
    if len(datos) > limite:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            f"El archivo supera el tamaño máximo de {nombre_limite}")
    return datos


def _guardar(datos: bytes, codigo: str, extension: str) -> str:
    CARPETA_EQUIPOS.mkdir(parents=True, exist_ok=True)
    # Nombre único para que el navegador no muestre una versión vieja guardada en caché
    nombre = f"{codigo}_{uuid.uuid4().hex[:8]}.{extension}"
    (CARPETA_EQUIPOS / nombre).write_bytes(datos)
    return f"equipos/{nombre}"


def guardar_foto(archivo: UploadFile, codigo: str) -> str:
    datos = _leer_con_limite(archivo, TAMANO_MAXIMO_FOTO, "5 MB")
    tipo = _tipo_imagen(datos)
    if tipo is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            "La fotografía debe ser JPG, PNG o WebP")
    return _guardar(datos, codigo, tipo)


def guardar_manual(archivo: UploadFile, codigo: str) -> str:
    datos = _leer_con_limite(archivo, TAMANO_MAXIMO_MANUAL, "10 MB")
    if not datos.startswith(b"%PDF-"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "El manual debe ser un archivo PDF")
    return _guardar(datos, codigo, "pdf")


def borrar(ruta_relativa: str | None) -> None:
    """Borra un archivo anterior. Si ya no existe, no pasa nada."""
    if not ruta_relativa:
        return
    ruta = (CARPETA_UPLOADS / ruta_relativa).resolve()
    # Seguridad: solo se borra dentro de uploads/
    if CARPETA_UPLOADS.resolve() in ruta.parents:
        ruta.unlink(missing_ok=True)


def url_publica(ruta_relativa: str | None) -> str | None:
    return f"/uploads/{ruta_relativa}" if ruta_relativa else None
