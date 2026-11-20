"""Datos JSON de la ventanilla, incidencias, sanciones y panel del encargado."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

from app.schemas.prestamos import EquipoEnPrestamo, EventoLinea


def _texto(valor: str | None, campo: str, minimo: int, maximo: int, obligatorio: bool = True) -> str | None:
    valor = (valor or "").strip()
    if not valor and not obligatorio:
        return None
    if len(valor) < minimo:
        raise ValueError(f"{campo} debe tener al menos {minimo} caracteres")
    if len(valor) > maximo:
        raise ValueError(f"{campo} no puede tener más de {maximo} caracteres")
    return valor


def _codigos_unicos(codigos: list[str]) -> None:
    if len(set(codigos)) != len(codigos):
        raise ValueError("Un equipo aparece repetido")


# ================================================================ entrega (SRS 8.4 y 8.5)


class ChecklistEntrega(BaseModel):
    codigo_inventario: str             # escrito o escaneado por el encargado
    entregado_completo: bool           # casilla "Se entrega completo"
    observaciones: str | None = None   # hasta 255 caracteres

    @field_validator("codigo_inventario")
    @classmethod
    def _codigo(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("observaciones")
    @classmethod
    def _obs(cls, v: str | None) -> str | None:
        return _texto(v, "Las observaciones", 0, 255, obligatorio=False)


class RegistroEntrega(BaseModel):
    equipos: list[ChecklistEntrega]
    pin: str

    @field_validator("pin")
    @classmethod
    def _pin(cls, v: str) -> str:
        v = v.strip()
        if len(v) != 4 or not v.isdigit():
            raise ValueError("El PIN debe tener 4 dígitos")
        return v

    @model_validator(mode="after")
    def _unicos(self):
        _codigos_unicos([e.codigo_inventario for e in self.equipos])
        return self


class VerificarCodigo(BaseModel):
    codigo_inventario: str

    @field_validator("codigo_inventario")
    @classmethod
    def _codigo(cls, v: str) -> str:
        return v.strip().upper()


# ================================================================ devolución (SRS 8.6 a 8.8)


class IncidenciaCaptura(BaseModel):
    """Modal de incidencia (SRS 8.7): evidencia y resolución de 5 a 255 caracteres."""
    tipo: Literal["Daño", "Pérdida"]
    descripcion: str        # "Evidencia descriptiva"
    resolucion: str         # "Resolución aplicada"

    @field_validator("descripcion")
    @classmethod
    def _descripcion(cls, v: str) -> str:
        return _texto(v, "La evidencia descriptiva", 5, 255)

    @field_validator("resolucion")
    @classmethod
    def _resolucion(cls, v: str) -> str:
        return _texto(v, "La resolución aplicada", 5, 255)


class InspeccionDevolucion(BaseModel):
    codigo_inventario: str
    estado: Literal["Bueno", "Dañado", "Incompleto"]
    observaciones: str | None = None
    incidencia: IncidenciaCaptura | None = None   # obligatoria si no está "Bueno"

    @field_validator("codigo_inventario")
    @classmethod
    def _codigo(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("observaciones")
    @classmethod
    def _obs(cls, v: str | None) -> str | None:
        return _texto(v, "Las observaciones", 0, 255, obligatorio=False)

    @model_validator(mode="after")
    def _incidencia(self):
        if self.estado != "Bueno" and self.incidencia is None:
            raise ValueError(f"{self.codigo_inventario}: registra la incidencia del equipo {self.estado.lower()}")
        if self.estado == "Bueno" and self.incidencia is not None:
            raise ValueError(f"{self.codigo_inventario}: un equipo en buen estado no lleva incidencia")
        # Dañado -> siempre Daño. Incompleto -> el encargado elige Daño o Pérdida (equipo no devuelto)
        if self.estado == "Dañado" and self.incidencia.tipo != "Daño":
            raise ValueError(f"{self.codigo_inventario}: un equipo dañado se registra como incidencia de Daño; "
                             "para un equipo perdido usa «Incompleto» con tipo «Pérdida»")
        return self


class RegistroDevolucion(BaseModel):
    equipos: list[InspeccionDevolucion]

    @model_validator(mode="after")
    def _unicos(self):
        _codigos_unicos([e.codigo_inventario for e in self.equipos])
        return self


class ResolucionEquipo(BaseModel):
    """Cómo se resolvió un equipo pendiente (ej. "El alumno repuso el cable BNC")."""
    observaciones: str

    @field_validator("observaciones")
    @classmethod
    def _obs(cls, v: str) -> str:
        return _texto(v, "Las observaciones", 5, 200)


# ================================================================ sanciones (SRS 8.9)


class SancionManual(BaseModel):
    boleta: str
    tipo: Literal["Retraso", "Daño", "Pérdida"]   # define la duración: 7, 15 días o indefinida
    motivo: str

    @field_validator("boleta")
    @classmethod
    def _boleta(cls, v: str) -> str:
        v = v.strip()
        if len(v) != 10 or not v.isdigit():
            raise ValueError("La boleta debe tener exactamente 10 dígitos")
        return v

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, v: str) -> str:
        return _texto(v, "El motivo", 5, 255)


class RetiroSancion(BaseModel):
    motivo: str

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, v: str) -> str:
        return _texto(v, "El motivo", 5, 255)


# ================================================================ salida


class PrestamoVentanilla(BaseModel):
    """Resultado de búsqueda en ventanilla. Nunca incluye el PIN."""
    folio: str
    estado: str
    estudiante: str
    boleta: str
    grupo: str
    equipos: list[EquipoEnPrestamo]
    fecha_hora_prog_retiro: datetime
    fecha_hora_limite_devolucion: datetime
    prorroga: bool
    puede_continuar: bool          # entrega: pasa las 4 verificaciones / devolución: siempre
    bloqueos: list[str]            # motivos por los que no se puede entregar (SRS 8.4)
    pin_bloqueado_hasta: datetime | None
    minutos_de_retraso: int        # solo devoluciones
    devolucion_registrada: bool    # ya se inspeccionó, pero quedó abierto por incidencias
    equipos_pendientes: list[str]  # equipos que faltan por resolver


class ResultadoBusqueda(BaseModel):
    mensaje: str | None            # "No hay préstamos por entregar" si la lista está vacía
    prestamos: list[PrestamoVentanilla]


class ResultadoCodigo(BaseModel):
    codigo_inventario: str
    pertenece: bool
    nombre: str | None
    mensaje: str


class IncidenciaRespuesta(BaseModel):
    id_incidencia: int
    folio_prestamo: str
    tipo: str
    codigo_inventario: str | None
    equipo: str | None
    estudiante: str
    boleta: str
    descripcion: str
    resolucion: str
    fecha_hora_registro: datetime
    registrada_por: str | None     # None = sistema


class SancionRespuesta(BaseModel):
    id_sancion: int
    estudiante: str
    boleta: str
    tipo: str | None               # tipo de la incidencia que la originó, si aplica
    motivo: str
    fecha_inicio: date
    fecha_fin: date | None         # None = indefinida
    estado: str
    motivo_condonacion: str | None


class ResultadoDevolucion(BaseModel):
    folio: str
    mensaje: str
    estado: str
    prestamo_cerrado: bool         # True = Devuelta; False = abierto por equipos pendientes
    equipos_pendientes: list[str]
    incidencias: list[IncidenciaRespuesta]
    sanciones: list[SancionRespuesta]


class DetalleVentanilla(PrestamoVentanilla):
    fecha_hora_solicitud: datetime
    fecha_hora_real_entrega: datetime | None
    fecha_hora_real_devolucion: datetime | None
    motivo_rechazo: str | None
    motivo_cancelacion: str | None
    linea_de_tiempo: list[EventoLinea]
    incidencias: list[IncidenciaRespuesta]


class CategoriaBajoStock(BaseModel):
    id_categoria: int
    nombre: str
    disponibles: int
    total_equipos: int


class DevolucionDelDia(BaseModel):
    folio: str
    estudiante: str
    boleta: str
    fecha_hora_limite_devolucion: datetime


class AvisoEncargado(BaseModel):
    """Aviso calculado al momento (no se guarda en la BD). `id` es estable para recordar si ya se leyó."""
    id: str
    tipo: str
    titulo: str
    mensaje: str
    folio: str | None
    fecha_hora: datetime


class PanelEncargado(BaseModel):
    """Contadores del SRS 8. Se recalculan en cada consulta."""
    solicitudes_pendientes: int
    prestamos_entregados: int
    prestamos_vencidos: int
    prestamos_con_pendientes: int  # devueltos con equipos dañados/incompletos sin resolver
    entregas_del_dia: int          # Aprobadas con retiro hoy
    devoluciones_del_dia: int      # Entregadas que deben devolverse hoy
    categorias_bajo_stock: list[CategoriaBajoStock]
    devoluciones_hoy: list[DevolucionDelDia]   # detalle de "devoluciones del día"


class HistorialEstudiante(BaseModel):
    """SRS 3.2: incidencias y sanciones del alumno."""
    incidencias: list[IncidenciaRespuesta]
    sanciones: list[SancionRespuesta]
