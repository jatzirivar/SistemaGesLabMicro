"""Ventanilla del encargado: entrega y devolución de equipo (SRS 8, 8.3 a 8.8)."""
import math
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constantes import (
    BAJO_STOCK_MENOS_DE,
    INTENTOS_MAXIMOS_PIN,
    MENSAJE_PIN_INCORRECTO,
    MENSAJE_SIN_DEVOLUCIONES,
    MENSAJE_SIN_ENTREGAS,
    MINUTOS_BLOQUEO_PIN,
    EstadoEquipo,
    EstadoPrestamo,
    InspeccionFisica,
    TipoIncidencia,
)
from app.core.dependencias import UsuarioSesion
from app.core.errores import ErrorDeNegocio
from app.core.tiempo import a_local, ahora, hoy
from app.models.inventario import Equipo
from app.models.prestamos import DetallePrestamo, Incidencia, Prestamo
from app.models.usuarios import Estudiante
from app.schemas.ventanilla import RegistroDevolucion, RegistroEntrega
from app.services import inventario_servicio
from app.services import prestamos_comun as comun
from app.services import sanciones_servicio

_INSPECCION_POR_NOMBRE = {"Bueno": InspeccionFisica.BUENO, "Dañado": InspeccionFisica.DANADO,
                          "Incompleto": InspeccionFisica.INCOMPLETO}
_TIPO_POR_NOMBRE = {"Daño": TipoIncidencia.DANO, "Pérdida": TipoIncidencia.PERDIDA}


# ======================================================================
# Utilidades
# ======================================================================

def _buscar(db: Session, buscar: str, estados: tuple[int, ...]) -> list[Prestamo]:
    """Por boleta (10 dígitos) o por código de inventario de cualquiera de sus equipos."""
    termino = buscar.strip().upper()
    consulta = (select(Prestamo).options(comun.CARGAR_EQUIPOS)
                .join(Estudiante, Estudiante.id_estudiante == Prestamo.id_estudiante)
                .where(Prestamo.id_estado_prestamo.in_(estados)))
    if termino.isdigit() and len(termino) == 10:
        consulta = consulta.where(Estudiante.boleta == termino)
    else:
        consulta = consulta.where(Prestamo.folio.in_(
            select(DetallePrestamo.folio_prestamo).where(DetallePrestamo.codigo_inventario == termino)))
    return list(db.scalars(consulta.order_by(Prestamo.fecha_hora_prog_retiro)).unique())


def bloqueos_de_entrega(db: Session, prestamo: Prestamo, config) -> list[str]:
    """Las 4 verificaciones previas al PIN (SRS 8.4)."""
    bloqueos = []
    momento = ahora()
    retiro = a_local(prestamo.fecha_hora_prog_retiro)
    fin = comun.fin_de_tolerancia(prestamo, config)

    if prestamo.id_estado_prestamo != EstadoPrestamo.APROBADA:
        bloqueos.append(f"El préstamo no está Aprobado (estado: "
                        f"{EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo]})")
    if momento < retiro:
        bloqueos.append(f"Aún no es la hora de retiro: se puede entregar de {retiro:%H:%M} a {fin:%H:%M} "
                        f"del {retiro:%d/%m/%Y}")
    elif momento > fin:
        bloqueos.append(f"Ya pasó la tolerancia de retiro ({fin:%H:%M})")

    for d in prestamo.detalles:
        if d.equipo.id_estado_equipo == EstadoEquipo.EN_MANTENIMIENTO:
            bloqueos.append(f"{d.codigo_inventario} está en mantenimiento")
        elif d.equipo.id_estado_equipo == EstadoEquipo.DADO_DE_BAJA:
            bloqueos.append(f"{d.codigo_inventario} fue dado de baja")
        elif d.equipo.id_estado_equipo == EstadoEquipo.PRESTADO:
            bloqueos.append(f"{d.codigo_inventario} sigue prestado en otro préstamo que no se ha devuelto")

    alertas = comun.alertas_estudiante(db, prestamo.estudiante)
    bloqueos += [a.replace("Tu cuenta", "La cuenta del alumno").replace("Tienes", "El alumno tiene")
                 for a in alertas]
    return bloqueos


def _minutos_retraso(prestamo: Prestamo, config) -> int:
    # Si ya se registró la devolución, el retraso se mide a esa hora y deja de crecer
    momento = a_local(prestamo.fecha_hora_real_devolucion) or ahora()
    exceso = (momento - comun.limite_de(prestamo, config)).total_seconds()
    return max(0, math.ceil(exceso / 60))


def _pendientes(prestamo: Prestamo) -> list[str]:
    """Equipos con devolución registrada que aún no quedan en "Bueno"."""
    if prestamo.fecha_hora_real_devolucion is None:
        return []
    return [d.codigo_inventario for d in prestamo.detalles if d.id_inspec_devolucion != InspeccionFisica.BUENO]


def _a_ventanilla(db: Session, prestamo: Prestamo, config, para_entrega: bool) -> dict:
    est = prestamo.estudiante
    bloqueos = bloqueos_de_entrega(db, prestamo, config) if para_entrega else []
    pin_hasta = a_local(prestamo.pin_bloqueado_hasta)
    return {
        "folio": prestamo.folio,
        "estado": EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo],
        "estudiante": est.nombre_completo,
        "boleta": est.boleta,
        "grupo": prestamo.grupo,
        "equipos": comun.equipos_de(prestamo),
        "fecha_hora_prog_retiro": a_local(prestamo.fecha_hora_prog_retiro),
        "fecha_hora_limite_devolucion": comun.limite_de(prestamo, config),
        "prorroga": prestamo.prorroga,
        "puede_continuar": not bloqueos,
        "bloqueos": bloqueos,
        "pin_bloqueado_hasta": pin_hasta if pin_hasta and pin_hasta > ahora() else None,
        "minutos_de_retraso": 0 if para_entrega else _minutos_retraso(prestamo, config),
        "devolucion_registrada": prestamo.fecha_hora_real_devolucion is not None,
        "equipos_pendientes": _pendientes(prestamo),
    }


def _prestamo_bloqueado(db: Session, folio: str) -> Prestamo:
    """Bloquea la fila del préstamo para que dos encargados no lo procesen a la vez."""
    folio = folio.strip().upper()
    if db.scalar(select(Prestamo.folio).where(Prestamo.folio == folio).with_for_update()) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Préstamo no encontrado")
    return db.scalar(select(Prestamo).options(comun.CARGAR_EQUIPOS).where(Prestamo.folio == folio))


# ======================================================================
# Panel y consulta
# ======================================================================

def panel(db: Session) -> dict:
    """Contadores del Panel Operativo del encargado (SRS 8)."""
    config = comun.configuracion_lab(db)

    def contar(estado: int) -> int:
        return db.scalar(select(func.count()).select_from(Prestamo).where(Prestamo.id_estado_prestamo == estado))

    hoy_ = hoy()
    aprobadas = db.scalars(select(Prestamo).where(Prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA)).all()
    activos = db.scalars(select(Prestamo).where(
        Prestamo.id_estado_prestamo.in_((EstadoPrestamo.ENTREGADA, EstadoPrestamo.VENCIDA)))).all()
    # Los que ya se devolvieron con incidencias se cuentan aparte, como "con pendientes"
    entregadas = [p for p in activos if p.id_estado_prestamo == EstadoPrestamo.ENTREGADA
                  and p.fecha_hora_real_devolucion is None]
    vencidas = [p for p in activos if p.id_estado_prestamo == EstadoPrestamo.VENCIDA
                and p.fecha_hora_real_devolucion is None]
    con_pendientes = [p for p in activos if p.fecha_hora_real_devolucion is not None]

    bajo_stock = [
        {"id_categoria": c["id_categoria"], "nombre": c["nombre"],
         "disponibles": c["disponibles"], "total_equipos": c["total_equipos"]}
        for c in inventario_servicio.listar_categorias(db)
        if c["total_equipos"] > 0 and c["disponibles"] < BAJO_STOCK_MENOS_DE
    ]
    return {
        "solicitudes_pendientes": contar(EstadoPrestamo.PENDIENTE),
        "prestamos_entregados": len(entregadas),
        "prestamos_vencidos": len(vencidas),
        "prestamos_con_pendientes": len(con_pendientes),
        "entregas_del_dia": sum(1 for p in aprobadas if a_local(p.fecha_hora_prog_retiro).date() == hoy_),
        "devoluciones_del_dia": sum(1 for p in entregadas if comun.limite_de(p, config).date() == hoy_),
        "categorias_bajo_stock": bajo_stock,
        "devoluciones_hoy": sorted(
            ({"folio": p.folio, "estudiante": p.estudiante.nombre_completo, "boleta": p.estudiante.boleta,
              "fecha_hora_limite_devolucion": comun.limite_de(p, config)}
             for p in entregadas if comun.limite_de(p, config).date() == hoy_),
            key=lambda d: d["fecha_hora_limite_devolucion"],
        ),
    }


def avisos_encargado(db: Session) -> list[dict]:
    """Avisos de la campana del encargado, calculados con el estado actual de los préstamos."""
    config = comun.configuracion_lab(db)
    momento = ahora()
    hoy_ = hoy()
    avisos = []
    prestamos = db.scalars(select(Prestamo).where(Prestamo.id_estado_prestamo.in_(
        (EstadoPrestamo.PENDIENTE, EstadoPrestamo.APROBADA, EstadoPrestamo.ENTREGADA, EstadoPrestamo.VENCIDA)))).all()
    for p in prestamos:
        alumno = p.estudiante.nombre_completo
        retiro = a_local(p.fecha_hora_prog_retiro)
        limite = comun.limite_de(p, config)
        if p.id_estado_prestamo == EstadoPrestamo.PENDIENTE:
            avisos.append({"tipo": "Pendiente", "titulo": "Nueva solicitud por revisar",
                           "mensaje": f"{p.folio} de {alumno}, retiro el {retiro:%d/%m/%Y} a las {retiro:%H:%M}.",
                           "fecha_hora": a_local(p.fecha_hora_solicitud)})
        elif p.id_estado_prestamo == EstadoPrestamo.APROBADA and retiro.date() == hoy_:
            avisos.append({"tipo": "Retiro", "titulo": "Retiro programado hoy",
                           "mensaje": f"{p.folio}: {alumno} recoge a las {retiro:%H:%M}.",
                           "fecha_hora": retiro})
        elif p.fecha_hora_real_devolucion is not None:
            avisos.append({"tipo": "Pendientes", "titulo": "Equipos pendientes por resolver",
                           "mensaje": f"{p.folio}: {alumno} devolvió con equipos dañados o incompletos.",
                           "fecha_hora": a_local(p.fecha_hora_real_devolucion)})
        elif p.id_estado_prestamo == EstadoPrestamo.VENCIDA:
            avisos.append({"tipo": "Vencido", "titulo": "Préstamo vencido",
                           "mensaje": f"{p.folio}: {alumno} debía devolver a las {limite:%H:%M} del {limite:%d/%m/%Y}.",
                           "fecha_hora": limite})
        elif momento <= limite <= momento + timedelta(minutes=15):
            avisos.append({"tipo": "Devolucion", "titulo": "Devolución próxima",
                           "mensaje": f"{p.folio}: {alumno} debe devolver a las {limite:%H:%M}.",
                           "fecha_hora": limite - timedelta(minutes=15)})
        else:
            continue
        avisos[-1].update({"id": f"{avisos[-1]['tipo']}-{p.folio}", "folio": p.folio})
    avisos.sort(key=lambda a: a["fecha_hora"], reverse=True)
    return avisos[:50]


def detalle(db: Session, folio: str) -> dict:
    prestamo = db.scalar(select(Prestamo).options(comun.CARGAR_EQUIPOS)
                         .where(Prestamo.folio == folio.strip().upper()))
    if prestamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Préstamo no encontrado")
    config = comun.configuracion_lab(db)
    para_entrega = prestamo.id_estado_prestamo == EstadoPrestamo.APROBADA
    return {
        **_a_ventanilla(db, prestamo, config, para_entrega),
        "fecha_hora_solicitud": a_local(prestamo.fecha_hora_solicitud),
        "fecha_hora_real_entrega": a_local(prestamo.fecha_hora_real_entrega),
        "fecha_hora_real_devolucion": a_local(prestamo.fecha_hora_real_devolucion),
        "motivo_rechazo": comun.motivo_rechazo_texto(prestamo),
        "motivo_cancelacion": prestamo.motivo_cancelacion,
        "linea_de_tiempo": comun.linea_de_tiempo(prestamo, config),
        "incidencias": sanciones_servicio.incidencias_de_folio(db, prestamo.folio),
    }


# ======================================================================
# Entrega (SRS 8.3, 8.4 y 8.5)
# ======================================================================

def buscar_entregas(db: Session, buscar: str) -> dict:
    config = comun.configuracion_lab(db)
    prestamos = _buscar(db, buscar, (EstadoPrestamo.APROBADA,))
    return {
        "mensaje": None if prestamos else MENSAJE_SIN_ENTREGAS,
        "prestamos": [_a_ventanilla(db, p, config, para_entrega=True) for p in prestamos],
    }


def verificar_codigo(db: Session, folio: str, codigo: str) -> dict:
    """Al escanear cada equipo: rechaza el que no pertenezca al préstamo (SRS 8.5)."""
    prestamo = db.scalar(select(Prestamo).options(comun.CARGAR_EQUIPOS)
                         .where(Prestamo.folio == folio.strip().upper()))
    if prestamo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Préstamo no encontrado")
    detalle_ = next((d for d in prestamo.detalles if d.codigo_inventario == codigo), None)
    if detalle_ is None:
        return {"codigo_inventario": codigo, "pertenece": False, "nombre": None,
                "mensaje": f"{codigo} no pertenece al préstamo {prestamo.folio}"}
    return {"codigo_inventario": codigo, "pertenece": True, "nombre": detalle_.equipo.nombre,
            "mensaje": f"{codigo} verificado"}


def registrar_entrega(db: Session, encargado: UsuarioSesion, folio: str, datos: RegistroEntrega) -> dict:
    prestamo = _prestamo_bloqueado(db, folio)
    config = comun.configuracion_lab(db)

    # 1. Verificaciones previas (SRS 8.4)
    bloqueos = bloqueos_de_entrega(db, prestamo, config)
    if bloqueos:
        raise ErrorDeNegocio(bloqueos)

    # 2. Checklist: todos los equipos del préstamo, ninguno ajeno, cada uno marcado (SRS 8.5)
    esperados = {d.codigo_inventario for d in prestamo.detalles}
    recibidos = {e.codigo_inventario: e for e in datos.equipos}
    errores = [f"{c} no pertenece a este préstamo" for c in sorted(set(recibidos) - esperados)]
    errores += [f"Falta verificar {c}" for c in sorted(esperados - set(recibidos))]
    errores += [f"{c}: marca la casilla «Se entrega completo»" for c, e in sorted(recibidos.items())
                if c in esperados and not e.entregado_completo]
    if errores:
        raise ErrorDeNegocio(errores, 422)

    # 3. PIN con bloqueo de 15 minutos tras 3 intentos fallidos
    momento = ahora()
    if prestamo.pin_bloqueado_hasta and prestamo.pin_bloqueado_hasta > momento:
        minutos = max(1, math.ceil((prestamo.pin_bloqueado_hasta - momento).total_seconds() / 60))
        raise ErrorDeNegocio(f"Validación de PIN bloqueada. Intenta de nuevo en {minutos} minuto(s).",
                             status.HTTP_423_LOCKED)

    if datos.pin != prestamo.codigo_pin:
        prestamo.intentos_pin += 1
        if prestamo.intentos_pin >= INTENTOS_MAXIMOS_PIN:
            prestamo.intentos_pin = 0
            prestamo.pin_bloqueado_hasta = momento + timedelta(minutes=MINUTOS_BLOQUEO_PIN)
            db.commit()
            raise ErrorDeNegocio(f"{MENSAJE_PIN_INCORRECTO}. Se bloqueó la validación del PIN por "
                                 f"{MINUTOS_BLOQUEO_PIN} minutos.", status.HTTP_423_LOCKED)
        restantes = INTENTOS_MAXIMOS_PIN - prestamo.intentos_pin
        db.commit()
        raise ErrorDeNegocio(f"{MENSAJE_PIN_INCORRECTO}. Te quedan {restantes} intento(s).", 400)

    # 4. Entrega correcta
    for d in prestamo.detalles:
        captura = recibidos[d.codigo_inventario]
        d.entregado_completo = True
        d.obs_entrega = captura.observaciones
        d.equipo.id_estado_equipo = EstadoEquipo.PRESTADO

    prestamo.id_estado_prestamo = EstadoPrestamo.ENTREGADA
    prestamo.fecha_hora_real_entrega = momento
    prestamo.id_encargado_entrega = encargado.id
    prestamo.codigo_pin = None        # ya cumplió su función
    prestamo.intentos_pin = 0
    prestamo.pin_bloqueado_hasta = None

    limite = comun.limite_de(prestamo, config)
    comun.notificar(db, prestamo.id_estudiante, "Equipo entregado",
                    f"Recibiste el equipo del préstamo {prestamo.folio}. Devuélvelo a más tardar a las "
                    f"{limite:%H:%M}.", prestamo.folio)
    db.commit()
    return detalle(db, prestamo.folio)


# ======================================================================
# Devolución (SRS 8.6, 8.7 y 8.8)
# ======================================================================

def buscar_devoluciones(db: Session, buscar: str) -> dict:
    config = comun.configuracion_lab(db)
    prestamos = _buscar(db, buscar, (EstadoPrestamo.ENTREGADA, EstadoPrestamo.VENCIDA))
    return {
        "mensaje": None if prestamos else MENSAJE_SIN_DEVOLUCIONES,
        "prestamos": [_a_ventanilla(db, p, config, para_entrega=False) for p in prestamos],
    }


def _registrar_incidencia(db: Session, prestamo: Prestamo, encargado: UsuarioSesion, id_tipo: int,
                          codigo: str | None, descripcion: str, resolucion: str) -> tuple[Incidencia, int]:
    """Crea la incidencia y su sanción según el tipo (SRS 8.7 y 8.9)."""
    incidencia = Incidencia(folio_prestamo=prestamo.folio, codigo_inventario=codigo, id_tipo_incidencia=id_tipo,
                            id_encargado=encargado.id, descripcion=descripcion, resolucion=resolucion)
    db.add(incidencia)
    db.flush()

    tipo = TipoIncidencia.NOMBRES[id_tipo]
    dias = sanciones_servicio.dias_por_tipo(db, id_tipo)
    equipo = f" ({codigo})" if codigo else ""
    sancion = comun.crear_sancion(db, prestamo.id_estudiante, f"{tipo}{equipo} en el préstamo {prestamo.folio}",
                                  dias, id_incidencia=incidencia.id_incidencia, id_encargado=encargado.id)
    db.flush()
    return incidencia, sancion.id_sancion


def registrar_devolucion(db: Session, encargado: UsuarioSesion, folio: str, datos: RegistroDevolucion) -> dict:
    prestamo = _prestamo_bloqueado(db, folio)
    if prestamo.id_estado_prestamo not in (EstadoPrestamo.ENTREGADA, EstadoPrestamo.VENCIDA):
        raise ErrorDeNegocio(f"El préstamo no está activo (estado: "
                             f"{EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo]})")
    if prestamo.fecha_hora_real_devolucion is not None:
        raise ErrorDeNegocio(f"La devolución de este préstamo ya se registró. Equipos pendientes de "
                             f"resolver: {', '.join(_pendientes(prestamo))}")
    config = comun.configuracion_lab(db)

    # Se inspeccionan TODOS los equipos del préstamo
    esperados = {d.codigo_inventario for d in prestamo.detalles}
    recibidos = {e.codigo_inventario: e for e in datos.equipos}
    errores = [f"{c} no pertenece a este préstamo" for c in sorted(set(recibidos) - esperados)]
    errores += [f"Falta inspeccionar {c}" for c in sorted(esperados - set(recibidos))]
    if errores:
        raise ErrorDeNegocio(errores, 422)

    momento = ahora()
    ids_incidencias, ids_sanciones = [], []

    # Retraso: se detecta solo si se devuelve después de la hora límite (7 días)
    retraso = _minutos_retraso(prestamo, config)
    if retraso > 0:
        inc, id_s = _registrar_incidencia(
            db, prestamo, encargado, TipoIncidencia.RETRASO, None,
            f"Devolución con {retraso} minuto(s) de retraso; límite {comun.limite_de(prestamo, config):%H:%M}",
            "Sanción automática por retraso")
        ids_incidencias.append(inc.id_incidencia)
        ids_sanciones.append(id_s)

    todos_bien = True
    for d in prestamo.detalles:
        inspeccion = recibidos[d.codigo_inventario]
        d.id_inspec_devolucion = _INSPECCION_POR_NOMBRE[inspeccion.estado]
        d.obs_devolucion = inspeccion.observaciones

        if inspeccion.estado == "Bueno":
            d.equipo.id_estado_equipo = EstadoEquipo.DISPONIBLE
            continue

        todos_bien = False
        captura = inspeccion.incidencia
        id_tipo = _TIPO_POR_NOMBRE[captura.tipo]
        inc, id_s = _registrar_incidencia(db, prestamo, encargado, id_tipo, d.codigo_inventario,
                                          captura.descripcion, captura.resolucion)
        ids_incidencias.append(inc.id_incidencia)
        ids_sanciones.append(id_s)

        if id_tipo == TipoIncidencia.PERDIDA:
            # Pérdida: baja automática del catálogo (SRS 8.7)
            d.equipo.id_estado_equipo = EstadoEquipo.DADO_DE_BAJA
            d.equipo.motivo_baja = f"Pérdida en el préstamo {prestamo.folio}"
            d.equipo.fecha_baja = hoy()
        else:
            # Daño (o componente faltante): a mantenimiento (SRS 8.7)
            d.equipo.id_estado_equipo = EstadoEquipo.EN_MANTENIMIENTO

    prestamo.fecha_hora_real_devolucion = momento
    prestamo.id_encargado_devolucion = encargado.id

    # SRS 8.8: solo se cierra si TODOS los equipos quedaron en "Bueno".
    # Si alguno quedó Dañado o Incompleto, el préstamo sigue abierto hasta resolverlo.
    if todos_bien:
        prestamo.id_estado_prestamo = EstadoPrestamo.DEVUELTA
        if ids_incidencias:  # solo el retraso
            mensaje = "Devolución registrada con retraso: se aplicó la sanción de 7 días"
            aviso = (f"Se registró la devolución del préstamo {prestamo.folio} con retraso. "
                     "Revisa tu historial para ver la sanción.")
        else:
            mensaje = "Devolución registrada: todos los equipos en buen estado. Préstamo cerrado."
            aviso = f"Se registró la devolución del préstamo {prestamo.folio}. ¡Gracias!"
    else:
        pendientes = ", ".join(_pendientes(prestamo))
        mensaje = (f"Devolución registrada con {len(ids_incidencias)} incidencia(s). El préstamo queda "
                   f"abierto hasta resolver: {pendientes}")
        aviso = (f"Se registró la devolución del préstamo {prestamo.folio} con incidencias en {pendientes}. "
                 "El préstamo seguirá abierto hasta que se resuelvan; acude con el encargado.")
    comun.notificar(db, prestamo.id_estudiante, "Devolución registrada", aviso, prestamo.folio)
    db.commit()

    return {
        "folio": prestamo.folio,
        "mensaje": mensaje,
        "estado": EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo],
        "prestamo_cerrado": prestamo.id_estado_prestamo == EstadoPrestamo.DEVUELTA,
        "equipos_pendientes": _pendientes(prestamo),
        "incidencias": sanciones_servicio.incidencias_por_ids(db, ids_incidencias),
        "sanciones": sanciones_servicio.sanciones_por_ids(db, ids_sanciones),
    }


def resolver_equipo(db: Session, encargado: UsuarioSesion, folio: str, codigo: str, observaciones: str) -> dict:
    """Marca como resuelto un equipo que quedó Dañado o Incompleto (el alumno lo reparó o lo repuso).

    Cuando ya no quedan pendientes, el préstamo pasa a Devuelta (SRS 8.8).
    No cambia el estado del equipo en inventario ni retira la sanción: eso se hace
    en /api/inventario y en /api/encargado/sanciones.
    """
    prestamo = _prestamo_bloqueado(db, folio)
    codigo = codigo.strip().upper()
    if prestamo.fecha_hora_real_devolucion is None or prestamo.id_estado_prestamo not in (
            EstadoPrestamo.ENTREGADA, EstadoPrestamo.VENCIDA):
        raise ErrorDeNegocio("Este préstamo no tiene equipos pendientes de resolver")

    detalle_ = next((d for d in prestamo.detalles if d.codigo_inventario == codigo), None)
    if detalle_ is None:
        raise ErrorDeNegocio(f"{codigo} no pertenece al préstamo {prestamo.folio}", 404)
    if detalle_.id_inspec_devolucion == InspeccionFisica.BUENO:
        raise ErrorDeNegocio(f"{codigo} ya está en buen estado; no hay nada que resolver")

    anterior = InspeccionFisica.NOMBRES.get(detalle_.id_inspec_devolucion, "")
    nota = f"Resuelto ({anterior}): {observaciones}"
    detalle_.obs_devolucion = (f"{detalle_.obs_devolucion} | {nota}" if detalle_.obs_devolucion else nota)[:255]
    detalle_.id_inspec_devolucion = InspeccionFisica.BUENO

    pendientes = _pendientes(prestamo)
    if not pendientes:
        prestamo.id_estado_prestamo = EstadoPrestamo.DEVUELTA
        mensaje = f"{codigo} resuelto. Ya no hay pendientes: préstamo cerrado."
        comun.notificar(db, prestamo.id_estudiante, "Préstamo cerrado",
                        f"Se resolvieron los pendientes del préstamo {prestamo.folio} y quedó cerrado.",
                        prestamo.folio)
    else:
        mensaje = f"{codigo} resuelto. Siguen pendientes: {', '.join(pendientes)}"
    db.commit()

    return {
        "folio": prestamo.folio,
        "mensaje": mensaje,
        "estado": EstadoPrestamo.NOMBRES[prestamo.id_estado_prestamo],
        "prestamo_cerrado": not pendientes,
        "equipos_pendientes": pendientes,
        "incidencias": sanciones_servicio.incidencias_de_folio(db, prestamo.folio),
        "sanciones": [],
    }
