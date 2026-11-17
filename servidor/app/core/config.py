"""Configuración del servidor, leída del archivo .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracion(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Base de datos
    db_usuario: str = "postgres"
    db_contrasena: str
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


configuracion = Configuracion()
