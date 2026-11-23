"""Solicitudes del estudiante: envío, consulta, cancelación y prórroga.

SRS 3, 3.1, 5, 5.1, 6, 6.1, 6.2, 6.3, 7, 7.1, 7.2 y 7.3.
"""
from collections import Counter
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import Boolean, func, select, text
from sqlalchemy.orm import Session

from app.core.constantes import (
    MENSAJE_AVISO_CANCELACION,
    EstadoEquipo,
    EstadoNotificacion,
    EstadoPrestamo,
)
from app.core.dependencias import UsuarioSesion
from app.core.errores import ErrorDeNegocio
from app.core.tiempo import ZONA, a_local, ahora
from app.models.configuracion import ConfiguracionLab, DiaInhabil
from app.models.inventario import Equipo
from app.models.prestamos import DetallePrestamo, Notificacion, Prestamo
from app.models.usuarios import Estudiante
from app.schemas.prestamos import DatosSolicitud, EnvioSolicitud
from app.services import prestamos_comun as comun

_DIAS = {1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo"}


# ======================================================================
# Validación de una solicitud (se usa al verificar y al enviar)
# ======================================================================

def _equipo_ocupado(db: Session, codigo: str, inicio: datetime, fin: datetime,
                    excluir_folio: str | None = None) -> bool:
    return bool(db.scalar(select(
        func.fn_equipo_ocupado(codigo, inicio, fin, excluir_folio, type_=Boolean)
    )))


def _validar_horario(db: Session, datos: DatosSolicitud, config: ConfiguracionLab) -> tuple[list[str], datetime, datetime]:
    errores = []
    hora = datos.hora_retiro.replace(tzinfo=None)
    retiro = datetime.combine(datos.fecha_retiro, hora.replace(second=0, microsecond=0), tzinfo=ZONA)
    limite = comun.limite_devolucion(retiro, False, config)

    clases = comun.horarios_clase(config)
    if hora.replace(second=0, microsecond=0) not in clases or hora.second:
        lista = ", ".join(f"{h:%H:%M}" for h in clases)
        errores.append(f"La hora de retiro debe ser al inicio de una clase: {lista}")
    if retiro <= ahora():
        errores.append("La fecha y hora de retiro ya pasaron")

    dia_semana = datos.fecha_retiro.isoweekday()
    if dia_semana not in config.dias_servicio:
        dias = ", ".join(_DIAS[d] for d in sorted(config.dias_servicio))
        errores.append(f"El laboratorio no da servicio en {_DIAS[dia_semana]} (días de servicio: {dias})")

    inhabil = db.get(DiaInhabil, datos.fecha_retiro)
    if inhabil:
        errores.append(f"El {datos.fecha_retiro:%d/%m/%Y} es día inhábil: {inhabil.descripcion}")

    # Retiro: de 07:00 a 20:30. Devolución: hasta las 22:00 (fin de la última clase).
    if not (config.horario_apertura <= retiro.time() <= config.horario_cierre):
        errores.append(
            f"El retiro debe programarse entre las {config.horario_apertura:%H:%M} y las "
            f"{config.horario_cierre:%H:%M}"
        )
    elif limite.date() != retiro.date() or limite.time() > config.hora_limite_devolucion:
        errores.append(
            f"Con retiro a las {retiro:%H:%M}, la devolución sería a las {limite:%H:%M} y el "
            f"límite para devolver es a las {config.hora_limite_devolucion:%H:%M}"
        )
    return errores, retiro, limite


def _validar_estudiante(db: Session, estudiante: Estudiante) -> list[str]:
    return [a + "; no puedes enviar solicitudes" for a in comun.alertas_estudiante(db, estudiante)]


def _validar_limites(db: Session, estudiante: Estudiante, equipos: list[Equipo],
                     config: ConfiguracionLab) -> list[str]:
    """Máximo 5 equipos a la vez y 2 piezas del mismo modelo (SRS 5.1 y 8.14)."""
    errores = []
    activos = list(db.scalars(
        select(Equipo.nombre)
        .join(DetallePrestamo, DetallePrestamo.codigo_inventario == Equipo.codigo_inventario)
        .join(Prestamo, Prestamo.folio == DetallePrestamo.folio_prestamo)
        .where(Prestamo.id_estudiante == estudiante.id_estudiante,
               Prestamo.id_estado_prestamo.in_(EstadoPrestamo.ACTIVOS))
    ))
    total = len(activos) + len(equipos)
    if total > config.limite_equipos:
        detalle = f" (ya tienes {len(activos)} en préstamos activos)" if activos else ""
        errores.append(f"Puedes tener máximo {config.limite_equipos} equipos a la vez{detalle}")

    conteo = Counter(activos + [e.nombre for e in equipos])
    for nombre in sorted({e.nombre for e in equipos}):
        if conteo[nombre] > config.limite_por_modelo:
            errores.append(f"Máximo {config.limite_por_modelo} piezas de «{nombre}», contando tus préstamos activos")
    return errores


def _revisar(db: Session, estudiante: Estudiante, datos: DatosSolicitud, bloquear: bool) -> dict:
    config = comun.configuracion_lab(db)
    errores, retiro, limite = _validar_horario(db, datos, config)
    errores += _validar_estudiante(db, estudiante)

    consulta = select(Equipo).where(Equipo.codigo_inventario.in_(datos.equipos)).order_by(Equipo.codigo_inventario)
    if bloquear:
        # Bloquea las filas de los equipos: dos alumnos no pueden apartar el mismo al mismo tiempo
        consulta = consulta.with_for_update()
    encontrados = {e.codigo_inventario: e for e in db.scalars(consulta)}

    revision = []
    for codigo in datos.equipos:
        equipo = encontrados.get(codigo)
        motivo = None
        if equipo is None:
            motivo = "El equipo no existe"
        elif equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA:
            motivo = "El equipo fue dado de baja"
        elif equipo.id_estado_equipo == EstadoEquipo.EN_MANTENIMIENTO:
            motivo = "El equipo está en mantenimiento"
        elif _equipo_ocupado(db, codigo, retiro, limite):
            motivo = "Ya está agendado en ese horario (préstamo aprobado)"
        revision.append({"codigo_inventario": codigo, "nombre": equipo.nombre if equipo else None,
                         "disponible": motivo is None, "motivo": motivo})
        if motivo:
            errores.append(f"{codigo}: {motivo}")

    errores += _validar_limites(db, estudiante, list(encontrados.values()), config)

    return {
        "valida": not errores,
        "errores": errores,
        "fecha_hora_retiro": retiro,
        "fecha_hora_limite_devolucion": limite,
        "equipos": revision,
    }


def reglas(db: Session) -> dict:
    """Configuración vigente (solo lectura) y los próximos días inhábiles."""
    c = comun.configuracion_lab(db)
    proximos = db.scalars(
        select(DiaInhabil).where(DiaInhabil.fecha_inhabil >= ahora().date())
        .order_by(DiaInhabil.fecha_inhabil).limit(60)
    )
    return {
        "horario_apertura": c.horario_apertura, "horario_cierre": c.horario_cierre,
        "hora_limite_devolucion": c.hora_limite_devolucion, "dias_servicio": sorted(c.dias_servicio),
        "duracion_ordinaria": c.duracion_ordinaria, "duracion_prorroga": c.duracion_prorroga,
        "duracion_maxima": c.duracion_maxima, "limite_equipos": c.limite_equipos,
        "limite_por_modelo": c.limite_por_modelo, "tolerancia_retiro": c.tolerancia_retiro,
        "dias_inhabiles": [{"fecha": d.fecha_inhabil, "descripcion": d.descripcion} for d in proximos],
        "horarios_retiro": comun.horarios_clase(c),
    }


def disponibilidad_por_clase(db: Session, equipos: list[str], fecha) -> dict:
    """Para cada clase del día: qué piezas del carrito están ocupadas (verde / amarillo / rojo)."""
    config = comun.configuracion_lab(db)
    motivo_dia = None
    if fecha.isoweekday() not in config.dias_servicio:
        motivo_dia = f"El laboratorio no da servicio en {_DIAS[fecha.isoweekday()]}"
    elif (inhabil := db.get(DiaInhabil, fecha)) is not None:
        motivo_dia = f"El {fecha:%d/%m/%Y} es día inhábil: {inhabil.descripcion}"
    elif fecha < ahora().date():
        motivo_dia = "La fecha ya pasó"

    encontrados = {e.codigo_inventario: e for e in db.scalars(select(Equipo).where(Equipo.codigo_inventario.in_(equipos)))}
    horarios = []
    for hora in comun.horarios_clase(config):
        retiro = datetime.combine(fecha, hora, tzinfo=ZONA)
        limite = comun.limite_devolucion(retiro, False, config)
        ocupados = []
        if motivo_dia is None:
            for codigo in equipos:
                equipo = encontrados.get(codigo)
                if equipo is None or equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA:
                    ocupados.append({"codigo_inventario": codigo, "motivo": "Ya no existe en el inventario"})
                elif equipo.id_estado_equipo == EstadoEquipo.EN_MANTENIMIENTO:
                    ocupados.append({"codigo_inventario": codigo, "motivo": "En mantenimiento"})
                elif _equipo_ocupado(db, codigo, retiro, limite):
                    ocupados.append({"codigo_inventario": codigo, "motivo": "Agendado en ese horario"})
        horarios.append({
            "hora_retiro": hora, "hora_devolucion": limite.time(),
            "pasado": retiro <= ahora(), "ocupados": ocupados, "total": len(equipos),
        })
    return {"fecha": fecha, "dia_valido": motivo_dia is None, "motivo_dia": motivo_dia, "horarios": horarios}


def verificar_solicitud(db: Session, usuario: UsuarioSesion, datos: DatosSolicitud) -> dict:
    """Revisa el carrito y el horario sin guardar nada (para habilitar "Enviar")."""
    return _revisar(db, usuario.cuenta, datos, bloquear=False)


# ======================================================================
# Envío (SRS 6.1)
# ======================================================================

def crear_solicitud(db: Session, usuario: UsuarioSesion, datos: EnvioSolicitud) -> Prestamo:
    # Bloquea al estudiante: si envía dos solicitudes al mismo tiempo, se procesan una por una
    estudiante = db.scalar(select(Estudiante).where(Estudiante.id_estudiante == usuario.id).with_for_update())
    revision = _revisar(db, estudiante, datos, bloquear=True)
    if not revision["valida"]:
        raise ErrorDeNegocio(revision["errores"], 422)

    folio = db.scalar(text(
        "SELECT 'PRE-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_folio_prestamo')::text, 6, '0')"
    ))
    prestamo = Prestamo(
        folio=folio,
        id_estudiante=estudiante.id_estudiante,
        grupo=datos.grupo,
        id_estado_prestamo=EstadoPrestamo.PENDIENTE,
        aceptacion_reglamento=True,
        fecha_hora_prog_retiro=revision["fecha_hora_retiro"],
        prorroga=False,
        intentos_pin=0,
        detalles=[DetallePrestamo(codigo_inventario=c) for c in datos.equipos],
    )
    db.add(prestamo)
    db.flush()  # primero el préstamo, luego el aviso que lo referencia

    comun.notificar(db, estudiante.id_estudiante, "Solicitud enviada",
                    f"Tu solicitud {folio} está en revisión. Retiro programado: "
                    f"{revision['fecha_hora_retiro']:%d/%m/%Y %H:%M}.", folio)
    db.commit()
    return obtener_prestamo(db, usuario, folio)


# ======================================================================
# Consulta (SRS 3, 3.1, 7)
# ======================================================================

def obtener_prestamo(db: Session, usuario: UsuarioSesion, folio: str) -> Prestamo:
    prestamo = db.scalar(
        select(Prestamo).options(comun.CARGAR_EQUIPOS)
        .where(Prestamo.folio == folio.strip().upper(), Prestamo.id_estudiante == usuario.id)
    )
    if prestamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    return prestamo


def _puede_cancelar(prestamo: Prestamo) -> bool:
    """Pendiente siempre; Aprobada solo antes de la hora de retiro (SRS 6.2)."""
    if prestamo.id_estado_prestamo == EstadoPrestamo.PENDIENTE:
        return True
    return (prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA
            and ahora() < a_local(prestamo.fecha_hora_prog_retiro))


def _problemas_prorroga(db: Session, prestamo: Prestamo, config: ConfiguracionLab,
                        revisar_equipos: bool) -> tuple[list[str], datetime]:
    """Reglas del SRS 6.3. Devuelve (motivos por los que no procede, nueva hora límite)."""
    actual = comun.limite_de(prestamo, config)
    nuevo = comun.limite_devolucion(prestamo.fecha_hora_prog_retiro, True, config)
    errores = []

    if prestamo.id_estado_prestamo != EstadoPrestamo.ENTREGADA:
        errores.append("Solo se puede extender un préstamo en estado Entregada")
    elif prestamo.fecha_hora_real_devolucion is not None:
        errores.append("El equipo ya se devolvió; no se puede extender")
    elif prestamo.prorroga:
        errores.append("Este préstamo ya tuvo su única prórroga")
    elif ahora() >= actual:
        errores.append("La hora de devolución ya venció")
    elif nuevo <= actual:
        errores.append(f"El préstamo ya tiene la duración máxima de {config.duracion_maxima // 60} horas")
    elif nuevo.date() != actual.date() or nuevo.time() > config.hora_limite_devolucion:
        errores.append(f"La nueva hora ({nuevo:%H:%M}) pasaría del límite para devolver "
                       f"({config.hora_limite_devolucion:%H:%M})")
    elif revisar_equipos:
        for d in prestamo.detalles:
            if _equipo_ocupado(db, d.codigo_inventario, actual, nuevo, excluir_folio=prestamo.folio):
                errores.append(f"{d.codigo_inventario} tiene una reserva posterior; no se puede extender")
    return errores, nuevo


def a_detalle(db: Session, prestamo: Prestamo) -> dict:
    config = comun.configuracion_lab(db)
    errores_prorroga, _ = _problemas_prorroga(db, prestamo, config, revisar_equipos=False)
    return {
        **comun.resumen(prestamo, config),
        "codigo_pin": prestamo.codigo_pin if prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA else None,
        "motivo_rechazo": comun.motivo_rechazo_texto(prestamo),
        "motivo_cancelacion": prestamo.motivo_cancelacion,
        "fecha_hora_real_entrega": a_local(prestamo.fecha_hora_real_entrega),
        "fecha_hora_real_devolucion": a_local(prestamo.fecha_hora_real_devolucion),
        "linea_de_tiempo": comun.linea_de_tiempo(prestamo, config),
        "puede_cancelar": _puede_cancelar(prestamo),
        "puede_solicitar_prorroga": not errores_prorroga,
        "aviso": MENSAJE_AVISO_CANCELACION,
    }


def mis_solicitudes(db: Session, usuario: UsuarioSesion) -> dict:
    config = comun.configuracion_lab(db)
    prestamos = db.scalars(
        select(Prestamo).options(comun.CARGAR_EQUIPOS)
        .where(Prestamo.id_estudiante == usuario.id)
        .order_by(Prestamo.fecha_hora_prog_retiro.desc())
    ).all()

    grupos = {"en_curso": [], "en_revision": [], "finalizadas": []}
    for p in prestamos:
        if p.id_estado_prestamo in EstadoPrestamo.EN_CURSO:
            grupos["en_curso"].append(comun.resumen(p, config))
        elif p.id_estado_prestamo in EstadoPrestamo.EN_REVISION:
            grupos["en_revision"].append(comun.resumen(p, config))
        else:
            grupos["finalizadas"].append(comun.resumen(p, config))
    # Lo próximo primero en los grupos activos
    grupos["en_curso"].sort(key=lambda r: r["fecha_hora_prog_retiro"])
    grupos["en_revision"].sort(key=lambda r: r["fecha_hora_prog_retiro"])
    return grupos


def panel(db: Session, usuario: UsuarioSesion) -> dict:
    estudiante = usuario.cuenta
    config = comun.configuracion_lab(db)
    activos = db.scalars(
        select(Prestamo).options(comun.CARGAR_EQUIPOS)
        .where(Prestamo.id_estudiante == usuario.id,
               Prestamo.id_estado_prestamo.in_(EstadoPrestamo.EN_CURSO))
        .order_by(Prestamo.fecha_hora_prog_retiro)
    ).all()
    pendientes = db.scalar(select(func.count()).select_from(Prestamo).where(
        Prestamo.id_estudiante == usuario.id, Prestamo.id_estado_prestamo == EstadoPrestamo.PENDIENTE))
    no_leidas = db.scalar(select(func.count()).select_from(Notificacion).where(
        Notificacion.id_estudiante == usuario.id,
        Notificacion.id_estado_notificacion == EstadoNotificacion.NO_LEIDA))
    sanciones = comun.sanciones_vigentes(db, usuario.id)
    alertas = comun.alertas_estudiante(db, estudiante)

    return {
        "prestamos_activos": [comun.resumen(p, config) for p in activos],
        "solicitudes_pendientes": pendientes,
        "sanciones_vigentes": [
            {"id_sancion": s.id_sancion, "motivo": s.motivo, "fecha_inicio": s.fecha_inicio, "fecha_fin": s.fecha_fin}
            for s in sanciones
        ],
        "cuenta_suspendida": usuario.suspendida,
        "tiene_adeudos": comun.tiene_adeudos(db, usuario.id),
        "puede_solicitar": not alertas,
        "alertas": alertas,
        "notificaciones_no_leidas": no_leidas,
    }


def comprobante(db: Session, usuario: UsuarioSesion, folio: str) -> dict:
    """SRS 7.2 y 7.3: solo para solicitudes aprobadas (o ya entregadas)."""
    prestamo = obtener_prestamo(db, usuario, folio)
    if prestamo.id_estado_prestamo not in (EstadoPrestamo.APROBADA, EstadoPrestamo.ENTREGADA):
        raise ErrorDeNegocio("El comprobante solo está disponible para solicitudes aprobadas")
    config = comun.configuracion_lab(db)
    estudiante = prestamo.estudiante
    return {
        "folio": prestamo.folio,
        "estado": EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo],
        "estudiante": estudiante.nombre_completo,
        "boleta": estudiante.boleta,
        "grupo": prestamo.grupo,
        "equipos": comun.equipos_de(prestamo),
        "fecha_hora_retiro": a_local(prestamo.fecha_hora_prog_retiro),
        "fecha_hora_devolucion": comun.limite_de(prestamo, config),
        "codigo_pin": prestamo.codigo_pin if prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA else None,
    }


# ======================================================================
# Cancelación (SRS 6.2) y prórroga (SRS 6.3)
# ======================================================================

def _bloquear_prestamo(db: Session, usuario: UsuarioSesion, folio: str) -> Prestamo:
    prestamo = db.scalar(
        select(Prestamo).where(Prestamo.folio == folio.strip().upper(),
                               Prestamo.id_estudiante == usuario.id).with_for_update()
    )
    if prestamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    return prestamo


def cancelar(db: Session, usuario: UsuarioSesion, folio: str) -> Prestamo:
    prestamo = _bloquear_prestamo(db, usuario, folio)
    if not _puede_cancelar(prestamo):
        if prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA:
            raise ErrorDeNegocio("La hora de retiro ya pasó; ya no se puede cancelar")
        raise ErrorDeNegocio("Solo puedes cancelar solicitudes en estado Pendiente o Aprobada")

    # Al dejar de estar activa, sus equipos quedan libres en ese horario
    prestamo.id_estado_prestamo = EstadoPrestamo.CANCELADA
    prestamo.codigo_pin = None  # se revoca el PIN
    prestamo.fecha_hora_cancelacion = ahora()
    prestamo.motivo_cancelacion = "Cancelada por el estudiante"
    db.commit()
    return obtener_prestamo(db, usuario, prestamo.folio)


def prorrogar(db: Session, usuario: UsuarioSesion, folio: str) -> Prestamo:
    _bloquear_prestamo(db, usuario, folio)
    prestamo = obtener_prestamo(db, usuario, folio)
    config = comun.configuracion_lab(db)

    errores, nuevo_limite = _problemas_prorroga(db, prestamo, config, revisar_equipos=True)
    if errores:
        raise ErrorDeNegocio(errores)

    prestamo.prorroga = True
    comun.notificar(db, usuario.id, "Prórroga autorizada",
                    f"Tu préstamo {prestamo.folio} se extendió una hora. "
                    f"Nueva hora de devolución: {nuevo_limite:%H:%M}.", prestamo.folio)
    db.commit()
    return prestamo
