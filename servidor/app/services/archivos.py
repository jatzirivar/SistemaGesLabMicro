"""Guarda fotos y manuales de equipos.

En la tabla equipo solo se guarda la ruta relativa (ej. "equipos/OSC-001_a1b2c3.jpg") y el
navegador los descarga en /uploads/<ruta>. Según ALMACEN_ARCHIVOS el contenido va:
  - "disco": en la carpeta uploads/ (tu PC).
  - "bd":    en la tabla archivo (hosting gratuito, cuyo disco se borra al reiniciarse).
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import text

from app.core.config import configuracion
from app.core.constantes import TAMANO_MAXIMO_FOTO, TAMANO_MAXIMO_MANUAL
from app.core.database import SesionLocal

CARPETA_UPLOADS = Path("uploads")
CARPETA_EQUIPOS = CARPETA_UPLOADS / "equipos"
EN_BD = configuracion.almacen_archivos == "bd"

TIPOS_MIME = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "pdf": "application/pdf"}


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
    # Nombre único para que el navegador no muestre una versión vieja guardada en caché
    nombre = f"{codigo}_{uuid.uuid4().hex[:8]}.{extension}"
    ruta = f"equipos/{nombre}"
    if EN_BD:
        with SesionLocal() as db:
            db.execute(text("INSERT INTO archivo (ruta, tipo_mime, contenido) VALUES (:r, :t, :c)"),
                       {"r": ruta, "t": TIPOS_MIME[extension], "c": datos})
            db.commit()
    else:
        CARPETA_EQUIPOS.mkdir(parents=True, exist_ok=True)
        (CARPETA_EQUIPOS / nombre).write_bytes(datos)
    return ruta


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
    if EN_BD:
        with SesionLocal() as db:
            db.execute(text("DELETE FROM archivo WHERE ruta = :r"), {"r": ruta_relativa})
            db.commit()
        return
    ruta = (CARPETA_UPLOADS / ruta_relativa).resolve()
    # Seguridad: solo se borra dentro de uploads/
    if CARPETA_UPLOADS.resolve() in ruta.parents:
        ruta.unlink(missing_ok=True)


def leer_de_bd(ruta_relativa: str) -> tuple[bytes, str] | None:
    """Contenido y tipo de un archivo guardado en la tabla archivo (modo "bd")."""
    with SesionLocal() as db:
        fila = db.execute(text("SELECT contenido, tipo_mime FROM archivo WHERE ruta = :r"),
                          {"r": ruta_relativa}).first()
    return (bytes(fila.contenido), fila.tipo_mime) if fila else None


def url_publica(ruta_relativa: str | None) -> str | None:
    return f"/uploads/{ruta_relativa}" if ruta_relativa else None
