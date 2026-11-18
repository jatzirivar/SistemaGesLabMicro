"""Administración del encargado: /api/encargado/... (SRS 8.13, 8.14 y 8.15)."""
from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.dependencias import requerir_encargado
from app.schemas.administracion import (
    AlumnoDetalle,
    AlumnoRegistrado,
    AlumnoResumen,
    CambioSuspension,
    ConfiguracionActualizar,
    ConfiguracionRespuesta,
    DiaInhabilCrear,
    DiaInhabilRespuesta,
    EncargadoRespuesta,
    EstadoFiltro,
    FilaHistorial,
    RegistroAlumnoManual,
    RegistroEncargado,
    ResultadoDiaInhabil,
)
from app.schemas.auth import Mensaje
from app.schemas.inventario import Pagina
from app.services import alumnos_servicio, configuracion_servicio, historial_servicio, reportes_pdf

router = APIRouter(prefix="/api/encargado", tags=["Administración (encargado)"],
                   dependencies=[Depends(requerir_encargado)])


# ================================================================ alumnos (SRS 8.13)

@router.get("/estudiantes", response_model=Pagina[AlumnoResumen])
def buscar_alumnos(buscar: str | None = Query(None, description="Nombre (parcial) o boleta"),
                   pagina: int = Query(1, ge=1), por_pagina: int = Query(20, ge=1, le=100),
                   db: Session = Depends(obtener_sesion)):
    return alumnos_servicio.buscar(db, buscar, pagina, por_pagina)


@router.post("/estudiantes", response_model=AlumnoRegistrado, status_code=status.HTTP_201_CREATED)
def registrar_alumno(datos: RegistroAlumnoManual, db: Session = Depends(obtener_sesion)):
    """Registro manual (cualquier dominio). El alumno crea su contraseña con "¿Olvidaste tu contraseña?"."""
    return alumnos_servicio.registrar(db, datos)


@router.get("/estudiantes/{id_estudiante}", response_model=AlumnoDetalle)
def historial_alumno(id_estudiante: int, db: Session = Depends(obtener_sesion)):
    """Historial de préstamos, incidencias y sanciones del alumno."""
    return alumnos_servicio.detalle(db, id_estudiante)


@router.patch("/estudiantes/{id_estudiante}/suspension", response_model=AlumnoResumen)
def cambiar_suspension(id_estudiante: int, datos: CambioSuspension, db: Session = Depends(obtener_sesion)):
    """Bloquear (`suspender: true`, con motivo) o desbloquear el envío de solicitudes por adeudos."""
    return alumnos_servicio.cambiar_suspension(db, id_estudiante, datos)


# ================================================================ encargados

@router.get("/encargados", response_model=list[EncargadoRespuesta])
def listar_encargados(db: Session = Depends(obtener_sesion)):
    return alumnos_servicio.listar_encargados(db)


@router.post("/encargados", response_model=EncargadoRespuesta, status_code=status.HTTP_201_CREATED)
def registrar_encargado(datos: RegistroEncargado, db: Session = Depends(obtener_sesion)):
    """Un encargado puede dar de alta a otro (contraseña de mínimo 10 caracteres)."""
    return alumnos_servicio.registrar_encargado(db, datos)


# ================================================================ configuración (SRS 8.14)

@router.get("/configuracion", response_model=ConfiguracionRespuesta)
def ver_configuracion(db: Session = Depends(obtener_sesion)):
    return configuracion_servicio.obtener(db)


@router.put("/configuracion", response_model=ConfiguracionRespuesta)
def editar_configuracion(datos: ConfiguracionActualizar, db: Session = Depends(obtener_sesion)):
    """Horarios, duración máxima, límite de equipos y tolerancia de retiro."""
    return configuracion_servicio.actualizar(db, datos)


@router.get("/dias-inhabiles", response_model=list[DiaInhabilRespuesta])
def listar_dias_inhabiles(incluir_pasados: bool = Query(False), db: Session = Depends(obtener_sesion)):
    return configuracion_servicio.listar_dias(db, incluir_pasados)


@router.post("/dias-inhabiles", response_model=ResultadoDiaInhabil, status_code=status.HTTP_201_CREATED)
def agregar_dia_inhabil(datos: DiaInhabilCrear, db: Session = Depends(obtener_sesion)):
    """Avisa si ya hay solicitudes Pendientes o Aprobadas para ese día (no las cancela)."""
    return configuracion_servicio.agregar_dia(db, datos)


@router.delete("/dias-inhabiles/{fecha}", response_model=Mensaje)
def eliminar_dia_inhabil(fecha: date, db: Session = Depends(obtener_sesion)):
    configuracion_servicio.eliminar_dia(db, fecha)
    return Mensaje(mensaje="Día inhábil eliminado")


# ================================================================ historial (SRS 8.15)

def _texto_filtros(desde, hasta, estudiante, codigo, estado) -> list[str]:
    filtros = []
    if desde or hasta:
        filtros.append(f"retiro del {desde:%d/%m/%Y}" if desde else "retiro")
        if hasta:
            filtros[-1] += f" al {hasta:%d/%m/%Y}"
    if estudiante:
        filtros.append(f"estudiante «{estudiante.strip()}»")
    if codigo:
        filtros.append(f"equipo {codigo.strip().upper()}")
    if estado:
        filtros.append(f"estado {estado}")
    return filtros


@router.get("/historial", response_model=Pagina[FilaHistorial])
def historial(desde: date | None = Query(None, description="AAAA-MM-DD"),
              hasta: date | None = Query(None, description="AAAA-MM-DD"),
              estudiante: str | None = Query(None, description="Boleta o nombre"),
              codigo: str | None = Query(None, description="Código de inventario"),
              estado: EstadoFiltro | None = Query(None),
              pagina: int = Query(1, ge=1), por_pagina: int = Query(20, ge=1, le=100),
              db: Session = Depends(obtener_sesion)):
    """Todas las operaciones de préstamo con filtros (fechas según el retiro programado)."""
    return historial_servicio.consultar(db, desde, hasta, estudiante, codigo, estado, pagina, por_pagina)


@router.get("/historial/pdf", response_class=Response,
            responses={200: {"content": {"application/pdf": {}}, "description": "Archivo PDF"}})
def historial_pdf(desde: date | None = Query(None), hasta: date | None = Query(None),
                  estudiante: str | None = Query(None), codigo: str | None = Query(None),
                  estado: EstadoFiltro | None = Query(None), db: Session = Depends(obtener_sesion)):
    """Exporta a PDF el historial con los mismos filtros."""
    filas, recortado = historial_servicio.para_pdf(db, desde, hasta, estudiante, codigo, estado)
    pdf = reportes_pdf.historial(filas, _texto_filtros(desde, hasta, estudiante, codigo, estado), recortado)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="historial_prestamos.pdf"'})
