"""Incidencias y sanciones: consulta, aplicación y retiro manual (SRS 3.2, 8.7 y 8.9)."""
from fastapi import HTTPException, status
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from app.core.constantes import EstadoSancion, TipoIncidencia
from app.core.dependencias import UsuarioSesion
from app.core.errores import ErrorDeNegocio
from app.core.tiempo import a_local, hoy
from app.models.inventario import Equipo
from app.models.prestamos import Incidencia, Prestamo, Sancion
from app.models.usuarios import Encargado, Estudiante
from app.schemas.ventanilla import SancionManual
from app.services import prestamos_comun as comun

_TIPO_POR_NOMBRE = {"Retraso": TipoIncidencia.RETRASO, "Daño": TipoIncidencia.DANO, "Pérdida": TipoIncidencia.PERDIDA}
_ESTADOS_SANCION = {EstadoSancion.VIGENTE: "Vigente", EstadoSancion.CUMPLIDA: "Cumplida",
                    EstadoSancion.CONDONADA: "Condonada"}


def dias_por_tipo(db: Session, id_tipo: int) -> int | None:
    """Días de sanción del catálogo tipo_incidencia (7, 15, NULL = indefinida, 2)."""
    return db.scalar(text("SELECT dias_sancion FROM tipo_incidencia WHERE id_tipo_incidencia = :t"),
                     {"t": id_tipo})


# ================================================================ incidencias

def _consulta_incidencias():
    return (
        select(Incidencia, Estudiante, Equipo.nombre, Encargado)
        .join(Prestamo, Prestamo.folio == Incidencia.folio_prestamo)
        .join(Estudiante, Estudiante.id_estudiante == Prestamo.id_estudiante)
        .outerjoin(Equipo, Equipo.codigo_inventario == Incidencia.codigo_inventario)
        .outerjoin(Encargado, Encargado.id_encargado == Incidencia.id_encargado)
        .order_by(Incidencia.fecha_hora_registro.desc(), Incidencia.id_incidencia.desc())
    )


def _incidencia_json(inc: Incidencia, est: Estudiante, equipo: str | None, enc: Encargado | None) -> dict:
    return {
        "id_incidencia": inc.id_incidencia,
        "folio_prestamo": inc.folio_prestamo,
        "tipo": TipoIncidencia.NOMBRES.get(inc.id_tipo_incidencia, "Otro"),
        "codigo_inventario": inc.codigo_inventario,
        "equipo": equipo,
        "estudiante": est.nombre_completo,
        "boleta": est.boleta,
        "descripcion": inc.descripcion,
        "resolucion": inc.resolucion,
        "fecha_hora_registro": a_local(inc.fecha_hora_registro),
        "registrada_por": enc.nombre_completo if enc else None,
    }


def incidencias_por_ids(db: Session, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    filas = db.execute(_consulta_incidencias().where(Incidencia.id_incidencia.in_(ids))).all()
    return [_incidencia_json(*f) for f in filas]


def incidencias_de_folio(db: Session, folio: str) -> list[dict]:
    filas = db.execute(_consulta_incidencias().where(Incidencia.folio_prestamo == folio)).all()
    return [_incidencia_json(*f) for f in filas]


def listar_incidencias(db: Session, buscar: str | None) -> list[dict]:
    """Busca por folio, boleta o código de equipo. Sin filtro: las 200 más recientes."""
    consulta = _consulta_incidencias()
    if buscar and buscar.strip():
        t = buscar.strip().upper()
        consulta = consulta.where(or_(Incidencia.folio_prestamo == t, Estudiante.boleta == t,
                                      Incidencia.codigo_inventario == t))
    return [_incidencia_json(*f) for f in db.execute(consulta.limit(200)).all()]


# ================================================================ sanciones

def _consulta_sanciones():
    return (
        select(Sancion, Estudiante, Incidencia.id_tipo_incidencia)
        .join(Estudiante, Estudiante.id_estudiante == Sancion.id_estudiante)
        .outerjoin(Incidencia, Incidencia.id_incidencia == Sancion.id_incidencia)
        .order_by(Sancion.fecha_inicio.desc(), Sancion.id_sancion.desc())
    )


def _estado_real(s: Sancion) -> str:
    # Si la tarea automática aún no corrió, una sanción ya terminada se muestra como Cumplida
    if s.id_estado_sancion == EstadoSancion.VIGENTE and s.fecha_fin and s.fecha_fin < hoy():
        return "Cumplida"
    return _ESTADOS_SANCION.get(s.id_estado_sancion, "Vigente")


def _sancion_json(s: Sancion, est: Estudiante, id_tipo: int | None) -> dict:
    return {
        "id_sancion": s.id_sancion,
        "estudiante": est.nombre_completo,
        "boleta": est.boleta,
        "tipo": TipoIncidencia.NOMBRES.get(id_tipo) if id_tipo else None,
        "motivo": s.motivo,
        "fecha_inicio": s.fecha_inicio,
        "fecha_fin": s.fecha_fin,
        "estado": _estado_real(s),
        "motivo_condonacion": s.motivo_condonacion,
    }


def sanciones_por_ids(db: Session, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    return [_sancion_json(*f) for f in db.execute(_consulta_sanciones().where(Sancion.id_sancion.in_(ids))).all()]


def listar_sanciones(db: Session, buscar: str | None, solo_vigentes: bool) -> list[dict]:
    consulta = _consulta_sanciones()
    if buscar and buscar.strip():
        consulta = consulta.where(Estudiante.boleta == buscar.strip())
    if solo_vigentes:
        consulta = consulta.where(Sancion.id_estado_sancion == EstadoSancion.VIGENTE,
                                  (Sancion.fecha_fin.is_(None)) | (Sancion.fecha_fin >= hoy()))
    return [_sancion_json(*f) for f in db.execute(consulta.limit(300)).all()]


def aplicar_sancion_manual(db: Session, encargado: UsuarioSesion, datos: SancionManual) -> dict:
    """SRS 8.9: el encargado aplica un bloqueo según el tipo (7 días, 15 días o indefinido)."""
    estudiante = db.scalar(select(Estudiante).where(Estudiante.boleta == datos.boleta))
    if estudiante is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No hay un estudiante con esa boleta")

    dias = dias_por_tipo(db, _TIPO_POR_NOMBRE[datos.tipo])
    sancion = comun.crear_sancion(db, estudiante.id_estudiante, f"{datos.tipo}: {datos.motivo}", dias,
                                  id_encargado=encargado.id)
    hasta = f"hasta el {sancion.fecha_fin:%d/%m/%Y}" if sancion.fecha_fin else "por tiempo indefinido"
    comun.notificar(db, estudiante.id_estudiante, "Sanción aplicada",
                    f"Se aplicó una sanción {hasta}. Motivo: {datos.tipo}: {datos.motivo}. "
                    "Mientras esté vigente no podrás solicitar ni recibir equipo.")
    db.commit()
    return sanciones_por_ids(db, [sancion.id_sancion])[0]


def retirar_sancion(db: Session, encargado: UsuarioSesion, id_sancion: int, motivo: str) -> dict:
    """SRS 8.9: retiro manual (también la única forma de terminar una indefinida)."""
    sancion = db.scalar(select(Sancion).where(Sancion.id_sancion == id_sancion).with_for_update())
    if sancion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sanción no encontrada")
    if _estado_real(sancion) != "Vigente":
        raise ErrorDeNegocio("La sanción ya no está vigente")

    sancion.id_estado_sancion = EstadoSancion.CONDONADA
    sancion.motivo_condonacion = f"{motivo} (retirada por {encargado.cuenta.nombre_completo})"[:255]
    comun.notificar(db, sancion.id_estudiante, "Sanción retirada",
                    f"El encargado retiró tu sanción «{sancion.motivo}». Ya puedes volver a solicitar equipo.")
    db.commit()
    return sanciones_por_ids(db, [sancion.id_sancion])[0]


# ================================================================ historial del alumno (SRS 3.2)

def historial_estudiante(db: Session, id_estudiante: int) -> dict:
    incidencias = db.execute(_consulta_incidencias().where(Prestamo.id_estudiante == id_estudiante)).all()
    sanciones = db.execute(_consulta_sanciones().where(Sancion.id_estudiante == id_estudiante)).all()
    return {
        "incidencias": [_incidencia_json(*f) for f in incidencias],
        "sanciones": [_sancion_json(*f) for f in sanciones],
    }
