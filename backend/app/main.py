"""Punto de entrada del servidor.

Ejecutar (con el entorno virtual activado):
    uvicorn app.main:app --reload
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import configuracion
from app.core.database import obtener_sesion
from app.core.dependencias import UsuarioSesion, requerir_encargado
from app.core.errores import registrar_manejadores
from app.core.tiempo import ahora
from app.routers import (administracion, auth, catalogo, categorias, dictamen, encargado, inventario,
                         notificaciones, solicitudes, ventanilla)
from app.schemas.prestamos import ResultadoTareas
from app.services import tareas
from app.services import archivos

log = logging.getLogger("uvicorn.error")
SEGUNDOS_ENTRE_TAREAS = 60


async def _ciclo_de_tareas():
    """Cada minuto: vencimientos, cancelaciones por no retiro, recordatorios y sanciones."""
    while True:
        try:
            await asyncio.to_thread(tareas.ejecutar_con_sesion_propia)
        except Exception:  # un error no debe detener el servidor
            log.exception("Error en las tareas automáticas")
        await asyncio.sleep(SEGUNDOS_ENTRE_TAREAS)


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    tarea = asyncio.create_task(_ciclo_de_tareas())
    yield
    tarea.cancel()


app = FastAPI(
    title="API - Préstamos del Laboratorio de Microprocesadores",
    description="ESIME CU · Equipo 2",
    version="0.8.0",
    lifespan=ciclo_de_vida,
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
app.include_router(catalogo.router)
app.include_router(categorias.router)
app.include_router(inventario.router)
app.include_router(solicitudes.router_panel)
app.include_router(solicitudes.router)
app.include_router(dictamen.router)
app.include_router(notificaciones.router)
app.include_router(ventanilla.router)
app.include_router(encargado.router)
app.include_router(administracion.router)

# Fotos y manuales: http://127.0.0.1:8000/uploads/equipos/<archivo>
if archivos.EN_BD:
    @app.get("/uploads/{ruta:path}", include_in_schema=False)
    def descargar_archivo(ruta: str):
        encontrado = archivos.leer_de_bd(ruta)
        if encontrado is None:
            raise HTTPException(404, "Archivo no encontrado")
        contenido, tipo = encontrado
        # El nombre del archivo cambia en cada carga, así que el navegador puede guardarlo en caché
        return Response(contenido, media_type=tipo, headers={"Cache-Control": "public, max-age=31536000, immutable"})
else:
    archivos.CARPETA_EQUIPOS.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=archivos.CARPETA_UPLOADS), name="uploads")


@app.get("/api/salud", tags=["Sistema"])
def revisar_salud(db: Session = Depends(obtener_sesion)):
    """Comprueba que el servidor está vivo y que lee la base de datos."""
    fila = db.execute(text("""
        SELECT horario_apertura,
               horario_cierre,
               hora_limite_devolucion,
               duracion_ordinaria,
               current_setting('TimeZone') AS zona,
               (SELECT count(*) FROM equipo) AS total_equipos
          FROM configuracion_lab
    """)).mappings().one()

    return {
        "estado": "ok",
        "base_de_datos": "conectada",
        "zona_horaria": fila["zona"],
        "hora_servidor": f"{ahora():%d/%m/%Y %H:%M}",
        "horario_retiro": f"{fila['horario_apertura']:%H:%M} a {fila['horario_cierre']:%H:%M}",
        "devolucion_hasta": f"{fila['hora_limite_devolucion']:%H:%M}",
        "duracion_prestamo_minutos": fila["duracion_ordinaria"],
        "equipos_registrados": fila["total_equipos"],
    }


@app.post("/api/sistema/tareas", response_model=ResultadoTareas, tags=["Sistema"])
def ejecutar_tareas(_: UsuarioSesion = Depends(requerir_encargado), db: Session = Depends(obtener_sesion)):
    """Ejecuta ahora las tareas automáticas (normalmente corren solas cada minuto). Útil para pruebas."""
    return {**tareas.ejecutar(db), "hora": ahora().time().replace(microsecond=0)}


# Página del frontend ya compilada (npm run build). En tu PC normalmente no existe y se usa
# "npm run dev"; en Render se compila y este mismo servidor la entrega. Va al final para no
# tapar las rutas de la API.
CARPETA_FRONTEND = Path(configuracion.carpeta_frontend).resolve()
if (CARPETA_FRONTEND / "index.html").is_file():
    @app.get("/{ruta:path}", include_in_schema=False)
    def pagina_frontend(ruta: str):
        if ruta.startswith(("api/", "uploads/")):
            raise HTTPException(404, "No encontrado")
        archivo = (CARPETA_FRONTEND / ruta).resolve()
        if ruta and CARPETA_FRONTEND in archivo.parents and archivo.is_file():
            # Los archivos de /assets llevan una huella en el nombre: se pueden guardar en caché
            cache = "public, max-age=31536000, immutable" if ruta.startswith("assets/") else "no-cache"
            return FileResponse(archivo, headers={"Cache-Control": cache})
        # Rutas de React (/estudiante/panel, /login...): siempre index.html
        return FileResponse(CARPETA_FRONTEND / "index.html", headers={"Cache-Control": "no-cache"})
