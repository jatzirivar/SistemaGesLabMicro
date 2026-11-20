"""Funciones compartidas por los servicios de préstamos (estudiante, encargado y tareas)."""
from datetime import datetime, timedelta

from sqlalchemy import exists, select, text
from sqlalchemy.orm import Session, selectinload

from app.core.constantes import (
    MINUTOS_PROXIMO_A_VENCER,
    EstadoCuenta,
    EstadoPrestamo,
    EstadoSancion,
    InspeccionFisica,
    MotivoRechazo,
    TipoIncidencia,
)
from app.core.tiempo import a_local, ahora, hoy
from app.models.configuracion import ConfiguracionLab
from app.models.inventario import Equipo
from app.models.prestamos import DetallePrestamo, Notificacion, Prestamo, Sancion
from app.models.usuarios import Estudiante

# Para cargar un préstamo con sus equipos y categorías en pocas consultas
CARGAR_EQUIPOS = selectinload(Prestamo.detalles).selectinload(DetallePrestamo.equipo).selectinload(Equipo.categoria)


# ================================================================ configuración y horas

def configuracion_lab(db: Session) -> ConfiguracionLab:
    return db.get(ConfiguracionLab, 1)


def limite_devolucion(retiro: datetime, prorroga: bool, config: ConfiguracionLab) -> datetime:
    """Igual que fn_limite_devolucion de la BD: 90 min (+60 con prórroga), tope 4 h."""
    minutos = config.duracion_ordinaria + (config.duracion_prorroga if prorroga else 0)
    return a_local(retiro) + timedelta(minutes=min(minutos, config.duracion_maxima))


def horarios_clase(config: ConfiguracionLab) -> list:
    """Inicios de clase para retirar: desde la apertura, cada duración ordinaria (90 min),
    mientras la devolución quepa antes de la hora límite. Ej. 07:00, 08:30 ... 20:30."""
    horarios = []
    inicio = datetime.combine(datetime.today(), config.horario_apertura)
    cierre = datetime.combine(datetime.today(), config.horario_cierre)
    limite = datetime.combine(datetime.today(), config.hora_limite_devolucion)
    paso = timedelta(minutes=config.duracion_ordinaria)
    while inicio <= cierre and inicio + paso <= limite:
        horarios.append(inicio.time())
        inicio += paso
    return horarios


def limite_de(prestamo: Prestamo, config: ConfiguracionLab) -> datetime:
    return limite_devolucion(prestamo.fecha_hora_prog_retiro, prestamo.prorroga, config)


def fin_de_tolerancia(prestamo: Prestamo, config: ConfiguracionLab) -> datetime:
    return a_local(prestamo.fecha_hora_prog_retiro) + timedelta(minutes=config.tolerancia_retiro)


# ================================================================ situación del estudiante

def sanciones_vigentes(db: Session, id_estudiante: int) -> list[Sancion]:
    return list(db.scalars(
        select(Sancion)
        .where(Sancion.id_estudiante == id_estudiante,
               Sancion.id_estado_sancion == EstadoSancion.VIGENTE,
               (Sancion.fecha_fin.is_(None)) | (Sancion.fecha_fin >= hoy()))
        .order_by(Sancion.fecha_inicio)
    ))


def tiene_adeudos(db: Session, id_estudiante: int) -> bool:
    """Adeudo = préstamo vencido sin devolver, o devuelto con equipos pendientes de resolver."""
    return bool(db.scalar(select(exists().where(
        Prestamo.id_estudiante == id_estudiante,
        (Prestamo.id_estado_prestamo == EstadoPrestamo.VENCIDA)
        | ((Prestamo.id_estado_prestamo == EstadoPrestamo.ENTREGADA)
           & Prestamo.fecha_hora_real_devolucion.is_not(None)),
    ))))


def alertas_estudiante(db: Session, estudiante: Estudiante) -> list[str]:
    """Motivos por los que el estudiante no puede solicitar ni recibir equipo."""
    alertas = []
    if estudiante.id_estado_cuenta == EstadoCuenta.SUSPENDIDA:
        alertas.append("Tu cuenta está suspendida por adeudos de material")
    for s in sanciones_vigentes(db, estudiante.id_estudiante):
        hasta = f"hasta el {s.fecha_fin:%d/%m/%Y}" if s.fecha_fin else "por tiempo indefinido"
        alertas.append(f"Sanción vigente {hasta}: {s.motivo}")
    if tiene_adeudos(db, estudiante.id_estudiante):
        alertas.append("Tienes préstamos vencidos o con equipos pendientes de resolver")
    return alertas


# ================================================================ avisos y sanciones

def dias_sancion_retraso(db: Session) -> int:
    """Días de sanción por Retraso según el catálogo tipo_incidencia (7)."""
    return db.scalar(text("SELECT dias_sancion FROM tipo_incidencia WHERE id_tipo_incidencia = :t"),
                     {"t": TipoIncidencia.RETRASO}) or 7



def notificar(db: Session, id_estudiante: int, titulo: str, mensaje: str, folio: str | None = None) -> None:
    """Crea un aviso en el perfil del estudiante (SRS 3.3 y 3.4). No hace commit."""
    db.add(Notificacion(id_estudiante=id_estudiante, folio_prestamo=folio,
                        titulo=titulo[:100], mensaje=mensaje[:500]))


def crear_sancion(db: Session, id_estudiante: int, motivo: str, dias: int | None,
                  id_incidencia: int | None = None, id_encargado: int | None = None) -> Sancion:
    """Sanción desde hoy. dias=None -> indefinida.

    "7 días contados a partir del día de su aplicación": hoy es el día 1,
    así que el último día es hoy + 6 (SRS 8.9).
    """
    inicio = hoy()
    sancion = Sancion(
        id_estudiante=id_estudiante,
        id_incidencia=id_incidencia,
        id_encargado=id_encargado,
        motivo=motivo[:255],
        fecha_inicio=inicio,
        fecha_fin=inicio + timedelta(days=dias - 1) if dias else None,
        id_estado_sancion=EstadoSancion.VIGENTE,
    )
    db.add(sancion)
    return sancion


# ================================================================ conversión a JSON

def _formato(fecha: datetime) -> str:
    return f"{a_local(fecha):%d/%m/%Y %H:%M}"


def equipos_de(prestamo: Prestamo) -> list[dict]:
    return [
        {
            "codigo_inventario": d.codigo_inventario,
            "nombre": d.equipo.nombre,
            "categoria": d.equipo.categoria.nombre,
            "entregado_completo": d.entregado_completo,
            "obs_entrega": d.obs_entrega,
            "inspeccion_devolucion": InspeccionFisica.NOMBRES.get(d.id_inspec_devolucion),
            "obs_devolucion": d.obs_devolucion,
        }
        for d in prestamo.detalles
    ]


def resumen(prestamo: Prestamo, config: ConfiguracionLab) -> dict:
    limite = limite_de(prestamo, config)
    restante = limite - ahora()
    return {
        "folio": prestamo.folio,
        "estado": EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo],
        "id_estado_prestamo": prestamo.id_estado_prestamo,
        "grupo": prestamo.grupo,
        "fecha_hora_solicitud": a_local(prestamo.fecha_hora_solicitud),
        "fecha_hora_prog_retiro": a_local(prestamo.fecha_hora_prog_retiro),
        "fecha_hora_limite_devolucion": limite,
        "prorroga": prestamo.prorroga,
        "proximo_a_vencer": (prestamo.id_estado_prestamo == EstadoPrestamo.ENTREGADA
                             and timedelta(0) < restante <= timedelta(minutes=MINUTOS_PROXIMO_A_VENCER)),
        "equipos": equipos_de(prestamo),
    }


def motivo_rechazo_texto(prestamo: Prestamo) -> str | None:
    if prestamo.id_motivo_rechazo is None:
        return None
    texto = MotivoRechazo.NOMBRES.get(prestamo.id_motivo_rechazo, "Otro")
    return f"{texto}: {prestamo.detalle_rechazo}" if prestamo.detalle_rechazo else texto


def linea_de_tiempo(prestamo: Prestamo, config: ConfiguracionLab) -> list[dict]:
    """Eventos del préstamo en orden (SRS 7)."""
    eventos = [{"estado": "Pendiente", "fecha_hora": a_local(prestamo.fecha_hora_solicitud),
                "descripcion": "Solicitud enviada"}]

    if prestamo.fecha_hora_dictamen:
        if prestamo.id_motivo_rechazo is not None:
            eventos.append({"estado": "Rechazada", "fecha_hora": a_local(prestamo.fecha_hora_dictamen),
                            "descripcion": motivo_rechazo_texto(prestamo)})
        else:
            eventos.append({"estado": "Aprobada", "fecha_hora": a_local(prestamo.fecha_hora_dictamen),
                            "descripcion": "Solicitud aprobada, se generó el PIN de entrega"})

    if prestamo.fecha_hora_real_entrega:
        eventos.append({"estado": "Entregada", "fecha_hora": a_local(prestamo.fecha_hora_real_entrega),
                        "descripcion": "Equipo entregado en ventanilla"})

    limite = limite_de(prestamo, config)
    devuelto_tarde = prestamo.fecha_hora_real_devolucion and prestamo.fecha_hora_real_devolucion > limite
    if prestamo.id_estado_prestamo == EstadoPrestamo.VENCIDA or devuelto_tarde:
        eventos.append({"estado": "Vencida", "fecha_hora": limite,
                        "descripcion": "Se pasó la hora límite de devolución"})

    if prestamo.fecha_hora_real_devolucion:
        if prestamo.id_estado_prestamo == EstadoPrestamo.DEVUELTA:
            eventos.append({"estado": "Devuelta", "fecha_hora": a_local(prestamo.fecha_hora_real_devolucion),
                            "descripcion": "Equipo devuelto en ventanilla"})
        else:
            eventos.append({"estado": "Devolución con pendientes",
                            "fecha_hora": a_local(prestamo.fecha_hora_real_devolucion),
                            "descripcion": "Se devolvió con equipos dañados o incompletos; "
                                           "queda abierto hasta resolverlos"})

    if prestamo.fecha_hora_cancelacion:
        eventos.append({"estado": "Cancelada", "fecha_hora": a_local(prestamo.fecha_hora_cancelacion),
                        "descripcion": prestamo.motivo_cancelacion})

    return sorted(eventos, key=lambda e: e["fecha_hora"])
