"""Consulta del historial de préstamos con filtros (SRS 8.15)."""
import math
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constantes import EstadoPrestamo
from app.core.errores import ErrorDeNegocio
from app.core.tiempo import ZONA, a_local
from app.models.prestamos import DetallePrestamo, Incidencia, Prestamo
from app.models.usuarios import Estudiante
from app.services import prestamos_comun as comun

MAXIMO_FILAS_PDF = 2000
_ID_POR_ESTADO = {nombre: id_ for id_, nombre in EstadoPrestamo.NOMBRES.items()}


def _filtros(desde: date | None, hasta: date | None, estudiante: str | None,
             codigo: str | None, estado: str | None) -> list:
    if desde and hasta and desde > hasta:
        raise ErrorDeNegocio("La fecha de inicio no puede ser posterior a la fecha de fin", 422)

    filtros = []
    # El rango se aplica a la fecha de retiro programada, en hora del laboratorio
    if desde:
        filtros.append(Prestamo.fecha_hora_prog_retiro >= datetime.combine(desde, time(0, 0), tzinfo=ZONA))
    if hasta:
        filtros.append(Prestamo.fecha_hora_prog_retiro
                       < datetime.combine(hasta + timedelta(days=1), time(0, 0), tzinfo=ZONA))
    if estudiante and estudiante.strip():
        termino = estudiante.strip()
        if termino.isdigit() and len(termino) == 10:
            filtros.append(Estudiante.boleta == termino)
        else:
            nombre = func.concat_ws(" ", Estudiante.nombre, Estudiante.apellido_pat, Estudiante.apellido_mat)
            filtros.append(nombre.ilike(f"%{termino}%"))
    if codigo and codigo.strip():
        filtros.append(Prestamo.folio.in_(
            select(DetallePrestamo.folio_prestamo)
            .where(DetallePrestamo.codigo_inventario == codigo.strip().upper())))
    if estado:
        filtros.append(Prestamo.id_estado_prestamo == _ID_POR_ESTADO[estado])
    return filtros


def _consulta(filtros: list):
    return (select(Prestamo).options(comun.CARGAR_EQUIPOS)
            .join(Estudiante, Estudiante.id_estudiante == Prestamo.id_estudiante)
            .where(*filtros))


def _fila(db: Session, p: Prestamo, config, incidencias: dict[str, int]) -> dict:
    return {
        "folio": p.folio,
        "estado": EstadoPrestamo.NOMBRES[p.id_estado_prestamo],
        "estudiante": p.estudiante.nombre_completo,
        "boleta": p.estudiante.boleta,
        "grupo": p.grupo,
        "equipos": comun.equipos_de(p),
        "fecha_hora_prog_retiro": a_local(p.fecha_hora_prog_retiro),
        "fecha_hora_limite_devolucion": comun.limite_de(p, config),
        "fecha_hora_real_entrega": a_local(p.fecha_hora_real_entrega),
        "fecha_hora_real_devolucion": a_local(p.fecha_hora_real_devolucion),
        "incidencias": incidencias.get(p.folio, 0),
    }


def _conteo_incidencias(db: Session, folios: list[str]) -> dict[str, int]:
    if not folios:
        return {}
    return dict(db.execute(
        select(Incidencia.folio_prestamo, func.count())
        .where(Incidencia.folio_prestamo.in_(folios))
        .group_by(Incidencia.folio_prestamo)
    ).all())


def consultar(db: Session, desde, hasta, estudiante, codigo, estado, pagina: int, por_pagina: int) -> dict:
    filtros = _filtros(desde, hasta, estudiante, codigo, estado)
    total = db.scalar(
        select(func.count()).select_from(Prestamo)
        .join(Estudiante, Estudiante.id_estudiante == Prestamo.id_estudiante)
        .where(*filtros))
    prestamos = db.scalars(
        _consulta(filtros).order_by(Prestamo.fecha_hora_prog_retiro.desc(), Prestamo.folio.desc())
        .limit(por_pagina).offset((pagina - 1) * por_pagina)
    ).all()
    config = comun.configuracion_lab(db)
    incidencias = _conteo_incidencias(db, [p.folio for p in prestamos])
    return {
        "elementos": [_fila(db, p, config, incidencias) for p in prestamos],
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total_paginas": max(1, math.ceil(total / por_pagina)),
    }


def para_pdf(db: Session, desde, hasta, estudiante, codigo, estado) -> tuple[list[dict], int]:
    """Todas las filas que cumplen los filtros (hasta 2000), de la más antigua a la más reciente."""
    filtros = _filtros(desde, hasta, estudiante, codigo, estado)
    prestamos = db.scalars(
        _consulta(filtros).order_by(Prestamo.fecha_hora_prog_retiro, Prestamo.folio).limit(MAXIMO_FILAS_PDF + 1)
    ).all()
    recortado = len(prestamos) > MAXIMO_FILAS_PDF
    prestamos = prestamos[:MAXIMO_FILAS_PDF]
    config = comun.configuracion_lab(db)
    incidencias = _conteo_incidencias(db, [p.folio for p in prestamos])
    return [_fila(db, p, config, incidencias) for p in prestamos], (MAXIMO_FILAS_PDF if recortado else 0)
