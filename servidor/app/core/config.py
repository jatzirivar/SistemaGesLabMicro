"""Configuración del servidor, leída del archivo .env (o de las variables de entorno en Render)."""
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Base de datos.
    # En línea (Neon) basta con DATABASE_URL; en tu PC se usan los DB_* de abajo.
    database_url: str | None = None
    db_usuario: str = "postgres"
    db_contrasena: str = ""
    db_host: str = "localhost"
    db_puerto: int = 5432
    db_nombre: str = "gestion_prestamos"

    # Sesiones JWT
    jwt_secreto: str
    jwt_minutos: int = 480

    # Frontend autorizado (CORS)
    cors_origenes: list[str] = ["http://localhost:5173"]

    # Zona horaria del laboratorio
    zona_horaria: str = "America/Mexico_City"

    # Dónde se guardan fotos y manuales:
    #   "disco" = carpeta uploads/ (tu PC)
    #   "bd"    = tabla archivo de la base de datos (hosting gratuito sin disco permanente)
    almacen_archivos: Literal["disco", "bd"] = "disco"

    # Página compilada del frontend (npm run build). Si existe, el servidor también la sirve.
    carpeta_frontend: str = "../frontend/dist"


configuracion = Configuracion()
