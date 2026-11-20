"""Datos JSON de solicitudes, préstamos y notificaciones."""
from datetime import date, datetime, time

from pydantic import BaseModel, field_validator

# ================================================================ entrada


class DatosSolicitud(BaseModel):
    """Carrito + horario (SRS 5, 6, 6.2). La devolución se calcula sola."""
    equipos: list[str]          # códigos de inventario, ej. ["OSC-001", "FUEN-002"]
    fecha_retiro: date          # AAAA-MM-DD
    hora_retiro: time           # HH:MM (en punto o y media)
    grupo: str

    @field_validator("equipos")
    @classmethod
    def _equipos(cls, v: list[str]) -> list[str]:
        codigos = [c.strip().upper() for c in v if c and c.strip()]
        if not codigos:
            raise ValueError("Agrega al menos un equipo al carrito")
        if len(set(codigos)) != len(codigos):
            raise ValueError("Un mismo equipo no puede repetirse en la solicitud")
        return codigos

    @field_validator("grupo")
    @classmethod
    def _grupo(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("El grupo es obligatorio")
        if len(v) > 6:
            raise ValueError("El grupo no puede tener más de 6 caracteres")
        return v


class EnvioSolicitud(DatosSolicitud):
    acepta_reglamento: bool

    @field_validator("acepta_reglamento")
    @classmethod
    def _reglamento(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Debes aceptar el reglamento del laboratorio")
        return v


class Rechazo(BaseModel):
    """SRS 8.2: motivo del checklist; "Otro" (5) exige detalle."""
    id_motivo_rechazo: int
    detalle: str | None = None

    @field_validator("id_motivo_rechazo")
    @classmethod
    def _motivo(cls, v: int) -> int:
        if v not in (1, 2, 3, 4, 5):
            raise ValueError("Motivo de rechazo inválido")
        return v

    @field_validator("detalle")
    @classmethod
    def _detalle(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip()
        if len(v) > 255:
            raise ValueError("El detalle no puede tener más de 255 caracteres")
        return v


# ================================================================ salida


class EquipoEnPrestamo(BaseModel):
    codigo_inventario: str
    nombre: str
    categoria: str
    entregado_completo: bool | None = None
    obs_entrega: str | None = None
    inspeccion_devolucion: str | None = None
    obs_devolucion: str | None = None


class RevisionEquipo(BaseModel):
    codigo_inventario: str
    nombre: str | None
    disponible: bool
    motivo: str | None          # por qué no se puede, si aplica


class RevisionSolicitud(BaseModel):
    """Respuesta de "verificar": lo que pasaría al enviar, sin guardar nada."""
    valida: bool
    errores: list[str]
    fecha_hora_retiro: datetime | None
    fecha_hora_limite_devolucion: datetime | None
    equipos: list[RevisionEquipo]


class EventoLinea(BaseModel):
    estado: str
    fecha_hora: datetime
    descripcion: str | None = None


class ResumenPrestamo(BaseModel):
    folio: str
    estado: str
    id_estado_prestamo: int
    grupo: str
    fecha_hora_solicitud: datetime
    fecha_hora_prog_retiro: datetime
    fecha_hora_limite_devolucion: datetime
    prorroga: bool
    proximo_a_vencer: bool
    equipos: list[EquipoEnPrestamo]


class DetallePrestamoRespuesta(ResumenPrestamo):
    codigo_pin: str | None          # solo se muestra si está Aprobada (SRS 7.1)
    motivo_rechazo: str | None
    motivo_cancelacion: str | None
    fecha_hora_real_entrega: datetime | None
    fecha_hora_real_devolucion: datetime | None
    linea_de_tiempo: list[EventoLinea]
    puede_cancelar: bool
    puede_solicitar_prorroga: bool
    aviso: str                          # SRS 3.5: no cancelar a tiempo es motivo de sanción


class DiaInhabilAviso(BaseModel):
    fecha: date
    descripcion: str


class ReglasSolicitud(BaseModel):
    """Horario y límites vigentes para armar la solicitud (Pantallas 5 y 6). Solo lectura."""
    horario_apertura: time          # primera hora para retirar
    horario_cierre: time            # última hora para retirar
    hora_limite_devolucion: time    # última hora para devolver
    dias_servicio: list[int]        # 1 = lunes ... 7 = domingo
    duracion_ordinaria: int         # minutos
    duracion_prorroga: int
    duracion_maxima: int
    limite_equipos: int
    limite_por_modelo: int
    tolerancia_retiro: int
    dias_inhabiles: list[DiaInhabilAviso]   # próximos días sin servicio
    horarios_retiro: list[time]             # inicios de clase: 07:00, 08:30 ... 20:30


class ConsultaDisponibilidad(BaseModel):
    equipos: list[str]
    fecha_retiro: date

    @field_validator("equipos")
    @classmethod
    def _equipos(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(c.strip().upper() for c in v if c and c.strip()))[:20]


class EquipoOcupado(BaseModel):
    codigo_inventario: str
    motivo: str


class HorarioClase(BaseModel):
    hora_retiro: time
    hora_devolucion: time
    pasado: bool                       # ya pasó la hora (hoy)
    ocupados: list[EquipoOcupado]      # 0 = verde, algunos = amarillo, todos = rojo
    total: int


class DisponibilidadDia(BaseModel):
    fecha: date
    dia_valido: bool
    motivo_dia: str | None
    horarios: list[HorarioClase]


class SolicitudCreada(BaseModel):
    folio: str
    mensaje: str
    solicitud: DetallePrestamoRespuesta


class MisSolicitudes(BaseModel):
    """SRS 3.1: tres grupos por estado."""
    en_curso: list[ResumenPrestamo]      # Aprobada, Entregada, Vencida
    en_revision: list[ResumenPrestamo]   # Pendiente
    finalizadas: list[ResumenPrestamo]   # Devuelta, Rechazada, Cancelada


class SancionResumen(BaseModel):
    id_sancion: int
    motivo: str
    fecha_inicio: date
    fecha_fin: date | None              # None = indefinida


class PanelEstudiante(BaseModel):
    """SRS 3: indicadores del alumno."""
    prestamos_activos: list[ResumenPrestamo]
    solicitudes_pendientes: int
    sanciones_vigentes: list[SancionResumen]
    cuenta_suspendida: bool
    tiene_adeudos: bool                 # préstamos vencidos sin devolver
    puede_solicitar: bool
    alertas: list[str]                  # textos para el banner rojo
    notificaciones_no_leidas: int


class Comprobante(BaseModel):
    """SRS 7.2 y 7.3."""
    folio: str
    estado: str
    estudiante: str
    boleta: str
    grupo: str
    equipos: list[EquipoEnPrestamo]
    fecha_hora_retiro: datetime
    fecha_hora_devolucion: datetime
    codigo_pin: str | None


class EquipoAlDictaminar(BaseModel):
    """Situación de cada pieza al aprobar o rechazar: ¿ya se devolvió? ¿está agendada en ese horario?"""
    codigo_inventario: str
    nombre: str
    situacion: str              # "libre" | "aviso" | "ocupado"
    detalle: str                # texto para el encargado
    otras_pendientes: list[str] # otras solicitudes Pendiente que piden la misma pieza en ese horario


class SolicitudPendiente(BaseModel):
    """Fila de la tabla del encargado (SRS 8.1)."""
    folio: str
    estudiante: str
    boleta: str
    grupo: str
    equipos: list[EquipoEnPrestamo]
    revision_equipos: list[EquipoAlDictaminar]
    puede_aprobar: bool         # falso si alguna pieza está agendada (Aprobada/Entregada) o dada de baja
    fecha_hora_solicitud: datetime
    fecha_hora_prog_retiro: datetime
    fecha_hora_limite_devolucion: datetime
    alertas: list[str]          # sanción vigente, cuenta suspendida, adeudos, equipo en mantenimiento


class MotivoRechazoRespuesta(BaseModel):
    id_motivo_rechazo: int
    motivo: str


class NotificacionRespuesta(BaseModel):
    id_notificacion: int
    titulo: str
    mensaje: str
    folio_prestamo: str | None
    fecha_hora_generacion: datetime
    leida: bool


class ResultadoTareas(BaseModel):
    pendientes_canceladas: int
    aprobadas_no_retiradas: int          # canceladas con sanción de 2 días
    aprobadas_canceladas_sin_sancion: int  # su equipo no estaba disponible para entregarse
    prestamos_vencidos: int
    recordatorios_enviados: int
    sanciones_cumplidas: int
    hora: time | None = None
