"""Punto de entrada del servidor.

Ejecutar (con el entorno virtual activado):
    uvicorn app.main:app --reload
"""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import configuracion
from app.core.database import obtener_sesion
from app.core.errores import registrar_manejadores
from app.routers import auth

app = FastAPI(
    title="API - Préstamos del Laboratorio de Microprocesadores",
    description="ESIME CU · Equipo 2",
    version="0.2.0",
)

# Permite que el frontend en React llame a esta API desde otro puerto
app.add_middleware(
    CORSMiddleware,
    allow_origins=configuracion.cors_origenes,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mensajes de error en español
registrar_manejadores(app)

# Módulos de la API
app.include_router(auth.router)


@app.get("/api/salud", tags=["Sistema"])
def revisar_salud(db: Session = Depends(obtener_sesion)):
    """Comprueba que el servidor está vivo y que lee la base de datos."""
    fila = db.execute(text("""
        SELECT horario_apertura,
               horario_cierre,
               duracion_ordinaria,
               current_setting('TimeZone') AS zona,
               (SELECT count(*) FROM equipo) AS total_equipos
          FROM configuracion_lab
    """)).mappings().one()

    return {
        "estado": "ok",
        "base_de_datos": "conectada",
        "zona_horaria": fila["zona"],
        "horario_laboratorio": f"{fila['horario_apertura']:%H:%M} a {fila['horario_cierre']:%H:%M}",
        "duracion_prestamo_minutos": fila["duracion_ordinaria"],
        "equipos_registrados": fila["total_equipos"],
    }
