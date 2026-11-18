"""Reglas de negocio del catálogo, el inventario y las categorías.

SRS 4, 4.1, 5 (estado del botón agregar), 8.8, 8.10, 8.11 y 8.12.
"""
import math
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import Boolean, and_, case, func, not_, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constantes import (
    DISPONIBLE,
    EN_MANTENIMIENTO,
    NO_DISPONIBLE,
    EstadoEquipo,
    EstadoPrestamo,
)
from app.models.inventario import Categoria, Equipo
from app.schemas.inventario import (
    CategoriaActualizar,
    CategoriaCrear,
    EquipoActualizar,
    EquipoCrear,
)
from app.services import archivos

# ======================================================================
# Utilidades
# ======================================================================


def _expresion_disponibilidad():
    """Disponibilidad EN ESTE MOMENTO (decisión de diseño, opción a).

    Un equipo está "Disponible" si su estado es Disponible y ningún préstamo
    activo lo ocupa ahora mismo. Si tiene una reserva más tarde, sigue
    apareciendo disponible; el choque de horario se revisa en el carrito.
    """
    ahora = datetime.now(timezone.utc)
    ocupado_ahora = func.fn_equipo_ocupado(
        Equipo.codigo_inventario, ahora, ahora + timedelta(minutes=1), type_=Boolean
    )
    disponible = and_(Equipo.id_estado_equipo == EstadoEquipo.DISPONIBLE, not_(ocupado_ahora))
    etiqueta = case(
        (Equipo.id_estado_equipo == EstadoEquipo.EN_MANTENIMIENTO, EN_MANTENIMIENTO),
        (disponible, DISPONIBLE),
        else_=NO_DISPONIBLE,
    )
    return disponible, etiqueta


def _filtro_busqueda(buscar: str | None):
    """Coincidencia parcial sin distinguir mayúsculas (SRS 4.1)."""
    if not buscar or not buscar.strip():
        return None
    patron = f"%{buscar.strip()}%"
    return or_(Equipo.nombre.ilike(patron), Equipo.codigo_inventario.ilike(patron))


def _total_paginas(total: int, por_pagina: int) -> int:
    return max(1, math.ceil(total / por_pagina))


def _equipo_o_404(db: Session, codigo: str) -> Equipo:
    equipo = db.get(Equipo, codigo.strip().upper())
    if equipo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipo no encontrado")
    return equipo


def _tiene_prestamos(db: Session, codigo: str, solo_activos: bool) -> bool:
    sql = """
        SELECT EXISTS (
            SELECT 1 FROM detalle_prestamo d
              JOIN prestamo p ON p.folio = d.folio_prestamo
             WHERE d.codigo_inventario = :codigo
               {filtro}
        )
    """.format(filtro="AND p.id_estado_prestamo = ANY(:estados)" if solo_activos else "")
    parametros = {"codigo": codigo}
    if solo_activos:
        parametros["estados"] = list(EstadoPrestamo.ACTIVOS)
    return bool(db.scalar(text(sql), parametros))


def a_inventario(equipo: Equipo) -> dict:
    return {
        "codigo_inventario": equipo.codigo_inventario,
        "nombre": equipo.nombre,
        "id_categoria": equipo.id_categoria,
        "categoria": equipo.categoria.nombre,
        "id_estado_equipo": equipo.id_estado_equipo,
        "estado": equipo.estado,
        "fecha_adquisicion": equipo.fecha_adquisicion,
        "descripcion": equipo.descripcion,
        "especificaciones": equipo.especificaciones,
        "componentes_incluidos": equipo.componentes_incluidos,
        "foto_url": archivos.url_publica(equipo.fotografia),
        "manual_url": archivos.url_publica(equipo.manual),
        "motivo_baja": equipo.motivo_baja,
        "fecha_baja": equipo.fecha_baja,
    }


def _a_catalogo(equipo: Equipo, categoria: str, disponibilidad: str) -> dict:
    return {
        "codigo_inventario": equipo.codigo_inventario,
        "nombre": equipo.nombre,
        "id_categoria": equipo.id_categoria,
        "categoria": categoria,
        "disponibilidad": disponibilidad,
        "se_puede_agregar": disponibilidad == DISPONIBLE,
        "foto_url": archivos.url_publica(equipo.fotografia),
    }


# ======================================================================
# Catálogo del estudiante (SRS 4 y 4.1)
# ======================================================================


def listar_catalogo(
    db: Session,
    buscar: str | None,
    id_categoria: int | None,
    disponibilidad: str | None,
    pagina: int,
    por_pagina: int,
) -> dict:
    disponible, etiqueta = _expresion_disponibilidad()

    filtros = [Equipo.id_estado_equipo != EstadoEquipo.DADO_DE_BAJA]
    if (busqueda := _filtro_busqueda(buscar)) is not None:
        filtros.append(busqueda)
    if id_categoria:
        filtros.append(Equipo.id_categoria == id_categoria)
    if disponibilidad == DISPONIBLE:
        filtros.append(disponible)
    elif disponibilidad == NO_DISPONIBLE:
        filtros.append(not_(disponible))

    total = db.scalar(select(func.count()).select_from(Equipo).where(*filtros))

    filas = db.execute(
        select(Equipo, Categoria.nombre, etiqueta)
        .join(Categoria, Categoria.id_categoria == Equipo.id_categoria)
        .where(*filtros)
        .order_by(Equipo.nombre, Equipo.codigo_inventario)
        .limit(por_pagina)
        .offset((pagina - 1) * por_pagina)
    ).all()

    return {
        "elementos": [_a_catalogo(eq, cat, disp) for eq, cat, disp in filas],
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total_paginas": _total_paginas(total, por_pagina),
    }


def detalle_catalogo(db: Session, codigo: str) -> dict:
    _, etiqueta = _expresion_disponibilidad()
    fila = db.execute(
        select(Equipo, Categoria.nombre, etiqueta)
        .join(Categoria, Categoria.id_categoria == Equipo.id_categoria)
        .where(Equipo.codigo_inventario == codigo.strip().upper(),
               Equipo.id_estado_equipo != EstadoEquipo.DADO_DE_BAJA)
    ).first()
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Equipo no encontrado")

    equipo, categoria, disponibilidad = fila
    return {
        **_a_catalogo(equipo, categoria, disponibilidad),
        "descripcion": equipo.descripcion,
        "especificaciones": equipo.especificaciones,
        "componentes_incluidos": equipo.componentes_incluidos,
        "manual_url": archivos.url_publica(equipo.manual),
    }


# ======================================================================
# Inventario del encargado (SRS 8.8, 8.10, 8.11)
# ======================================================================


def listar_inventario(
    db: Session,
    buscar: str | None,
    id_categoria: int | None,
    id_estado_equipo: int | None,
    pagina: int,
    por_pagina: int,
) -> dict:
    filtros = []
    if (busqueda := _filtro_busqueda(buscar)) is not None:
        filtros.append(busqueda)
    if id_categoria:
        filtros.append(Equipo.id_categoria == id_categoria)
    if id_estado_equipo:
        filtros.append(Equipo.id_estado_equipo == id_estado_equipo)

    total = db.scalar(select(func.count()).select_from(Equipo).where(*filtros))
    equipos = db.scalars(
        select(Equipo)
        .where(*filtros)
        .order_by(Equipo.codigo_inventario)
        .limit(por_pagina)
        .offset((pagina - 1) * por_pagina)
    ).all()

    return {
        "elementos": [a_inventario(e) for e in equipos],
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total_paginas": _total_paginas(total, por_pagina),
    }


def obtener_equipo(db: Session, codigo: str) -> Equipo:
    return _equipo_o_404(db, codigo)


def crear_equipo(db: Session, datos: EquipoCrear) -> Equipo:
    if db.get(Categoria, datos.id_categoria) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La categoría no existe")

    try:
        # Código automático PREFIJO-### que nunca se reutiliza (SRS 8.11)
        codigo = db.scalar(select(func.fn_siguiente_codigo(datos.id_categoria)))
        equipo = Equipo(
            codigo_inventario=codigo,
            id_categoria=datos.id_categoria,
            nombre=datos.nombre,
            descripcion=datos.descripcion,
            especificaciones=datos.especificaciones,
            componentes_incluidos=datos.componentes_incluidos,
            fecha_adquisicion=datos.fecha_adquisicion,
            id_estado_equipo=EstadoEquipo.DISPONIBLE,
        )
        db.add(equipo)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "La categoría llegó al máximo de 999 equipos")
    db.refresh(equipo)
    return equipo


def actualizar_equipo(db: Session, codigo: str, datos: EquipoActualizar) -> Equipo:
    equipo = _equipo_o_404(db, codigo)
    if equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA:
        raise HTTPException(status.HTTP_409_CONFLICT, "No se puede editar un equipo dado de baja")

    equipo.nombre = datos.nombre
    equipo.descripcion = datos.descripcion
    equipo.especificaciones = datos.especificaciones
    equipo.componentes_incluidos = datos.componentes_incluidos
    equipo.fecha_adquisicion = datos.fecha_adquisicion
    db.commit()
    return equipo


def cambiar_estado(db: Session, codigo: str, nuevo_estado: str) -> Equipo:
    """Solo Disponible <-> En mantenimiento. "Prestado" lo maneja el módulo de préstamos."""
    equipo = _equipo_o_404(db, codigo)
    if equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA:
        raise HTTPException(status.HTTP_409_CONFLICT, "El equipo está dado de baja")
    if equipo.id_estado_equipo == EstadoEquipo.PRESTADO:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "El equipo está prestado; su estado cambiará al registrarse la devolución")

    equipo.id_estado_equipo = (EstadoEquipo.EN_MANTENIMIENTO if nuevo_estado == EN_MANTENIMIENTO
                               else EstadoEquipo.DISPONIBLE)
    db.commit()
    return equipo


def dar_de_baja(db: Session, codigo: str, motivo: str) -> Equipo:
    """Baja lógica: el equipo y su historial se conservan (SRS 8.10)."""
    equipo = _equipo_o_404(db, codigo)
    if equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA:
        raise HTTPException(status.HTTP_409_CONFLICT, "El equipo ya está dado de baja")
    if _tiene_prestamos(db, equipo.codigo_inventario, solo_activos=True):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "No se puede dar de baja: el equipo está en un préstamo "
                            "pendiente, aprobado, entregado o vencido")

    equipo.id_estado_equipo = EstadoEquipo.DADO_DE_BAJA
    equipo.motivo_baja = motivo
    equipo.fecha_baja = date.today()
    db.commit()
    return equipo


def eliminar_equipo(db: Session, codigo: str) -> None:
    """Borrado definitivo, solo si el equipo nunca ha estado en un préstamo (SRS 8.12).

    Sirve para corregir un alta hecha por error. Su código no se reutiliza.
    """
    equipo = _equipo_o_404(db, codigo)
    if _tiene_prestamos(db, equipo.codigo_inventario, solo_activos=False):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "No se puede eliminar: el equipo ya fue asignado a un préstamo. "
                            "Puedes darlo de baja para conservar su historial.")
    foto, manual = equipo.fotografia, equipo.manual
    db.delete(equipo)
    db.commit()
    archivos.borrar(foto)
    archivos.borrar(manual)


def subir_foto(db: Session, codigo: str, archivo: UploadFile) -> Equipo:
    equipo = _equipo_o_404(db, codigo)
    anterior = equipo.fotografia
    equipo.fotografia = archivos.guardar_foto(archivo, equipo.codigo_inventario)
    db.commit()
    archivos.borrar(anterior)
    return equipo


def subir_manual(db: Session, codigo: str, archivo: UploadFile) -> Equipo:
    equipo = _equipo_o_404(db, codigo)
    anterior = equipo.manual
    equipo.manual = archivos.guardar_manual(archivo, equipo.codigo_inventario)
    db.commit()
    archivos.borrar(anterior)
    return equipo


# ======================================================================
# Categorías (SRS 8.12)
# ======================================================================


def listar_categorias(db: Session) -> list[dict]:
    total = func.count(Equipo.codigo_inventario).filter(
        Equipo.id_estado_equipo != EstadoEquipo.DADO_DE_BAJA)
    disponibles = func.count(Equipo.codigo_inventario).filter(
        Equipo.id_estado_equipo == EstadoEquipo.DISPONIBLE)

    filas = db.execute(
        select(Categoria, total, disponibles)
        .outerjoin(Equipo, Equipo.id_categoria == Categoria.id_categoria)
        .group_by(Categoria.id_categoria)
        .order_by(Categoria.nombre)
    ).all()
    return [
        {"id_categoria": c.id_categoria, "nombre": c.nombre, "prefijo": c.prefijo,
         "total_equipos": t, "disponibles": d}
        for c, t, d in filas
    ]


def _categoria_o_404(db: Session, id_categoria: int) -> Categoria:
    categoria = db.get(Categoria, id_categoria)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")
    return categoria


def _validar_unicos(db: Session, nombre: str, prefijo: str | None, excluir_id: int | None = None) -> None:
    consulta = select(Categoria.id_categoria).where(func.lower(Categoria.nombre) == nombre.lower())
    if excluir_id:
        consulta = consulta.where(Categoria.id_categoria != excluir_id)
    if db.scalar(consulta):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una categoría con ese nombre")

    if prefijo:
        consulta = select(Categoria.id_categoria).where(Categoria.prefijo == prefijo)
        if excluir_id:
            consulta = consulta.where(Categoria.id_categoria != excluir_id)
        if db.scalar(consulta):
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una categoría con ese prefijo")


def _resumen_categoria(db: Session, id_categoria: int) -> dict:
    return next(c for c in listar_categorias(db) if c["id_categoria"] == id_categoria)


def crear_categoria(db: Session, datos: CategoriaCrear) -> dict:
    _validar_unicos(db, datos.nombre, datos.prefijo)
    categoria = Categoria(nombre=datos.nombre, prefijo=datos.prefijo, ultimo_consecutivo=0)
    db.add(categoria)
    db.commit()
    return _resumen_categoria(db, categoria.id_categoria)


def actualizar_categoria(db: Session, id_categoria: int, datos: CategoriaActualizar) -> dict:
    categoria = _categoria_o_404(db, id_categoria)
    nuevo_prefijo = datos.prefijo if datos.prefijo and datos.prefijo != categoria.prefijo else None

    # Si ya se generaron códigos con el prefijo, cambiarlo los dejaría inconsistentes
    if nuevo_prefijo and categoria.ultimo_consecutivo > 0:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "No se puede cambiar el prefijo: ya se generaron códigos con él")

    _validar_unicos(db, datos.nombre, nuevo_prefijo, excluir_id=id_categoria)
    categoria.nombre = datos.nombre
    if nuevo_prefijo:
        categoria.prefijo = nuevo_prefijo
    db.commit()
    return _resumen_categoria(db, id_categoria)


def eliminar_categoria(db: Session, id_categoria: int) -> None:
    categoria = _categoria_o_404(db, id_categoria)
    tiene_equipos = db.scalar(
        select(func.count()).select_from(Equipo).where(Equipo.id_categoria == id_categoria))
    if tiene_equipos:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "No se puede eliminar: la categoría tiene equipos registrados")
    db.delete(categoria)
    db.commit()
