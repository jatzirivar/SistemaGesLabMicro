"""Administración y bloqueo de usuarios (SRS 8.13) y alta de encargados."""
import math
import secrets

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.constantes import EstadoCuenta, EstadoPrestamo
from app.core.errores import ErrorDeNegocio
from app.core.seguridad import generar_hash
from app.core.tiempo import a_local, ahora
from app.models.prestamos import Prestamo
from app.models.usuarios import Encargado, Estudiante
from app.schemas.administracion import CambioSuspension, RegistroAlumnoManual, RegistroEncargado
from app.services import prestamos_comun as comun
from app.services import sanciones_servicio

_ESTADOS_CUENTA = {EstadoCuenta.ACTIVA: "Activa", EstadoCuenta.SUSPENDIDA: "Suspendida",
                   EstadoCuenta.BLOQUEADA: "Bloqueada"}


def _nombre_completo_sql(modelo):
    return func.concat_ws(" ", modelo.nombre, modelo.apellido_pat, modelo.apellido_mat)


def _resumen(db: Session, e: Estudiante) -> dict:
    activos = db.scalar(select(func.count()).select_from(Prestamo).where(
        Prestamo.id_estudiante == e.id_estudiante, Prestamo.id_estado_prestamo.in_(EstadoPrestamo.ACTIVOS)))
    bloqueo = a_local(e.bloqueado_hasta)
    return {
        "id_estudiante": e.id_estudiante,
        "boleta": e.boleta,
        "nombre_completo": e.nombre_completo,
        "correo": e.correo,
        "estado_cuenta": _ESTADOS_CUENTA.get(e.id_estado_cuenta, "Desconocido"),
        "suspendido": e.id_estado_cuenta == EstadoCuenta.SUSPENDIDA,
        "bloqueado_temporalmente": bool(bloqueo and bloqueo > ahora()),
        "sanciones_vigentes": len(comun.sanciones_vigentes(db, e.id_estudiante)),
        "prestamos_activos": activos,
        "tiene_adeudos": comun.tiene_adeudos(db, e.id_estudiante),
    }


def _alumno_o_404(db: Session, id_estudiante: int) -> Estudiante:
    alumno = db.get(Estudiante, id_estudiante)
    if alumno is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alumno no encontrado")
    return alumno


# ================================================================ búsqueda y consulta

def buscar(db: Session, termino: str | None, pagina: int, por_pagina: int) -> dict:
    """Por nombre (parcial, sin distinguir mayúsculas) o por boleta (SRS 8.13)."""
    filtros = []
    if termino and termino.strip():
        patron = f"%{termino.strip()}%"
        filtros.append(or_(Estudiante.boleta.ilike(patron), _nombre_completo_sql(Estudiante).ilike(patron)))

    total = db.scalar(select(func.count()).select_from(Estudiante).where(*filtros))
    alumnos = db.scalars(
        select(Estudiante).where(*filtros)
        .order_by(Estudiante.apellido_pat, Estudiante.apellido_mat, Estudiante.nombre)
        .limit(por_pagina).offset((pagina - 1) * por_pagina)
    ).all()
    return {
        "elementos": [_resumen(db, a) for a in alumnos],
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total_paginas": max(1, math.ceil(total / por_pagina)),
    }


def detalle(db: Session, id_estudiante: int) -> dict:
    """Historial de préstamos, incidencias y sanciones del alumno."""
    alumno = _alumno_o_404(db, id_estudiante)
    config = comun.configuracion_lab(db)
    prestamos = db.scalars(
        select(Prestamo).options(comun.CARGAR_EQUIPOS)
        .where(Prestamo.id_estudiante == id_estudiante)
        .order_by(Prestamo.fecha_hora_prog_retiro.desc())
    ).all()
    return {
        "alumno": _resumen(db, alumno),
        "prestamos": [comun.resumen(p, config) for p in prestamos],
        **sanciones_servicio.historial_estudiante(db, id_estudiante),
    }


# ================================================================ registro manual

def _contrasena_aleatoria() -> str:
    """Contraseña larga y aleatoria que nadie conoce ni se muestra.

    El alumno crea la suya con "¿Olvidaste tu contraseña?" (SRS 1.3).
    """
    return secrets.token_urlsafe(32)[:48]


def registrar(db: Session, datos: RegistroAlumnoManual) -> dict:
    if db.scalar(select(Estudiante.id_estudiante).where(Estudiante.boleta == datos.boleta)):
        raise ErrorDeNegocio("La boleta ya está registrada")
    if db.scalar(select(Estudiante.id_estudiante).where(func.lower(Estudiante.correo) == datos.correo)):
        raise ErrorDeNegocio("El correo ya está registrado")

    alumno = Estudiante(
        boleta=datos.boleta, nombre=datos.nombre, apellido_pat=datos.apellido_pat,
        apellido_mat=datos.apellido_mat, correo=datos.correo, contrasena_hash=generar_hash(_contrasena_aleatoria()),
        intentos_fallidos=0, id_estado_cuenta=EstadoCuenta.ACTIVA,
    )
    db.add(alumno)
    db.commit()
    db.refresh(alumno)
    return {
        "alumno": _resumen(db, alumno),
        "mensaje": f"Alumno registrado. Para entrar por primera vez debe usar «¿Olvidaste tu contraseña?» "
                   f"con su correo ({alumno.correo}) y crear su propia contraseña.",
    }


# ================================================================ bloqueo por adeudos

def cambiar_suspension(db: Session, id_estudiante: int, datos: CambioSuspension) -> dict:
    alumno = db.scalar(select(Estudiante).where(Estudiante.id_estudiante == id_estudiante).with_for_update())
    if alumno is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alumno no encontrado")

    if datos.suspender:
        if alumno.id_estado_cuenta == EstadoCuenta.SUSPENDIDA:
            raise ErrorDeNegocio("El alumno ya está suspendido")
        alumno.id_estado_cuenta = EstadoCuenta.SUSPENDIDA
        comun.notificar(db, alumno.id_estudiante, "Cuenta suspendida",
                        f"No puedes enviar solicitudes por adeudo de material. Motivo: {datos.motivo}. "
                        "Acude con el encargado del laboratorio.")
    else:
        if alumno.id_estado_cuenta != EstadoCuenta.SUSPENDIDA:
            raise ErrorDeNegocio("El alumno no está suspendido")
        # Si además tenía un bloqueo temporal vigente por contraseña, ese se respeta
        alumno.id_estado_cuenta = EstadoCuenta.ACTIVA
        mensaje = "Ya puedes volver a enviar solicitudes de préstamo."
        if datos.motivo:
            mensaje += f" Nota del encargado: {datos.motivo}."
        comun.notificar(db, alumno.id_estudiante, "Cuenta reactivada", mensaje)
    db.commit()
    return _resumen(db, alumno)


# ================================================================ encargados

def registrar_encargado(db: Session, datos: RegistroEncargado) -> dict:
    if db.scalar(select(Encargado.id_encargado).where(func.lower(Encargado.correo) == datos.correo)):
        raise ErrorDeNegocio("Ya existe un encargado con ese correo")
    encargado = Encargado(
        nombre=datos.nombre, apellido_pat=datos.apellido_pat, apellido_mat=datos.apellido_mat,
        correo=datos.correo, contrasena_hash=generar_hash(datos.contrasena),
        intentos_fallidos=0, id_estado_cuenta=EstadoCuenta.ACTIVA,
    )
    db.add(encargado)
    db.commit()
    db.refresh(encargado)
    return _encargado_json(encargado)


def listar_encargados(db: Session) -> list[dict]:
    return [_encargado_json(e) for e in db.scalars(select(Encargado).order_by(Encargado.nombre))]


def _encargado_json(e: Encargado) -> dict:
    return {"id_encargado": e.id_encargado, "nombre_completo": e.nombre_completo, "correo": e.correo,
            "estado_cuenta": _ESTADOS_CUENTA.get(e.id_estado_cuenta, "Desconocido")}
