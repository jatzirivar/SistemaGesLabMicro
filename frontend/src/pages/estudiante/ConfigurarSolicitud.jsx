// Pantalla 6: Configuración del carrito y envío (SRS 6, 6.1 y 6.2).
// El estudiante elige fecha y hora de retiro y su grupo; la devolución se calcula
// sola (retiro + duración del préstamo). Cada cambio se verifica con el servidor
// y "Enviar solicitud" solo se habilita si todo es válido y aceptó el reglamento.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/cliente'
import FotoEquipo from '../../components/FotoEquipo'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Encabezado, Pasos, Tarjeta } from '../../components/Pagina'
import { useCarrito } from '../../context/CarritoContext'
import { aMinutos, deMinutos, diaSemana, diasServicio, duracion, fecha as fmtFecha, hoyISO, minutosAhora } from '../../utils/formato'
import { agrupar } from './Carrito'

// Valores de respaldo si no se pudieron cargar las reglas del servidor
const RESPALDO = {
  horario_apertura: '07:00:00',
  horario_cierre: '20:30:00',
  hora_limite_devolucion: '22:00:00',
  dias_servicio: [1, 2, 3, 4, 5],
  duracion_ordinaria: 90,
  duracion_maxima: 240,
  dias_inhabiles: [],
}

const campo =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-guinda-700 focus:ring-2 focus:ring-guinda-100 disabled:bg-slate-50 disabled:text-slate-500'

export default function ConfigurarSolicitud() {
  const carrito = useCarrito()
  const navegar = useNavigate()
  const reglas = carrito.reglas ?? RESPALDO

  const [fechaRetiro, setFechaRetiro] = useState('')
  const [horaRetiro, setHoraRetiro] = useState('')
  const [grupo, setGrupo] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [revision, setRevision] = useState(null) // respuesta de /solicitudes/verificar
  const [verificando, setVerificando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [creada, setCreada] = useState(null) // { folio } al enviar con éxito

  const minutosPrestamo = Math.min(reglas.duracion_ordinaria, reglas.duracion_maxima)
  const hoy = hoyISO()

  // Horas de retiro: en punto o y media, dentro del horario y sin pasarse del límite de devolución
  const horas = []
  for (let m = aMinutos(reglas.horario_apertura); m <= aMinutos(reglas.horario_cierre); m += 30) {
    if (m + minutosPrestamo > aMinutos(reglas.hora_limite_devolucion)) break
    if (fechaRetiro === hoy && m <= minutosAhora()) continue
    horas.push(deMinutos(m))
  }

  // Revisión rápida en el navegador (el servidor vuelve a revisar todo)
  let errorFecha = null
  if (fechaRetiro) {
    const inhabil = reglas.dias_inhabiles.find((d) => d.fecha === fechaRetiro)
    if (fechaRetiro < hoy) errorFecha = 'La fecha de retiro ya pasó'
    else if (!reglas.dias_servicio.includes(diaSemana(fechaRetiro))) errorFecha = `El laboratorio solo da servicio de ${diasServicio(reglas.dias_servicio)}`
    else if (inhabil) errorFecha = `El ${fmtFecha(fechaRetiro)} es día inhábil: ${inhabil.descripcion}`
    else if (horas.length === 0) errorFecha = 'Ya no quedan horarios de retiro para ese día'
  }

  const horaValida = horas.includes(horaRetiro)
  const grupoLimpio = grupo.trim().toUpperCase()
  const listo = carrito.total > 0 && fechaRetiro && !errorFecha && horaValida && grupoLimpio.length > 0
  const codigos = carrito.equipos.map((e) => e.codigo_inventario)
  const llaveRevision = listo ? JSON.stringify([codigos, fechaRetiro, horaRetiro, grupoLimpio]) : null

  // Verifica con el servidor 400 ms después del último cambio
  useEffect(() => {
    if (!llaveRevision) return
    let activo = true
    const id = setTimeout(async () => {
      const [equipos, fecha_retiro, hora_retiro, grupoEnvio] = JSON.parse(llaveRevision)
      setVerificando(true)
      try {
        const r = await api('/solicitudes/verificar', { metodo: 'POST', datos: { equipos, fecha_retiro, hora_retiro, grupo: grupoEnvio } })
        if (activo) setRevision({ llave: llaveRevision, ...r })
      } catch (e) {
        if (activo) setRevision({ llave: llaveRevision, valida: false, errores: e.errores?.length ? e.errores.map((x) => x.mensaje) : [e.message], equipos: [] })
      } finally {
        if (activo) setVerificando(false)
      }
    }, 400)
    return () => {
      activo = false
      clearTimeout(id)
    }
  }, [llaveRevision])

  const vigente = revision && revision.llave === llaveRevision ? revision : null
  const puedeEnviar = Boolean(vigente?.valida && acepta && !enviando && !verificando)
  const devolucion = horaValida ? deMinutos(aMinutos(horaRetiro) + minutosPrestamo) : ''

  const enviar = async (e) => {
    e.preventDefault()
    if (!puedeEnviar) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const r = await api('/solicitudes', {
        metodo: 'POST',
        datos: { equipos: codigos, fecha_retiro: fechaRetiro, hora_retiro: horaRetiro, grupo: grupoLimpio, acepta_reglamento: true },
      })
      setCreada(r)
      carrito.vaciar()
    } catch (err) {
      setErrorEnvio(err)
      setRevision(null)
    } finally {
      setEnviando(false)
    }
  }

  if (creada) return <Exito folio={creada.folio} navegar={navegar} />

  if (carrito.total === 0) {
    return (
      <div>
        <Tarjeta className="mx-auto max-w-lg text-center">
          <p className="text-sm text-slate-600">Tu carrito está vacío. Agrega equipos desde el catálogo para armar tu solicitud.</p>
          <Link to="/estudiante/catalogo" className={`${boton.primario} mt-4`}>
            Ir al catálogo
          </Link>
        </Tarjeta>
      </div>
    )
  }

  const grupos = agrupar(carrito.equipos)
  const revisionDe = (codigo) => vigente?.equipos.find((x) => x.codigo_inventario === codigo)

  return (
    <form onSubmit={enviar} noValidate>
      <Encabezado
        antetitulo="Solicitud de préstamo"
        titulo="Configura tu solicitud"
        descripcion="Indica cuándo recogerás los equipos y tu grupo."
        derecha={<Pasos actual={3} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Tarjeta>
          <div className="mb-5 flex items-center gap-3 border-b border-slate-200 pb-4">
            <span className="rounded-lg bg-guinda-50 p-2 text-guinda-800">
              <Icono nombre="calendario" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Detalles del préstamo</h2>
              <p className="text-xs text-slate-500">Todos los campos son obligatorios.</p>
            </div>
          </div>

          <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <Icono nombre="reloj" className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-xs">
              <p className="text-sm font-semibold">
                Horario de servicio: {diasServicio(reglas.dias_servicio)}
              </p>
              <p>
                Retiro de {reglas.horario_apertura.slice(0, 5)} a {reglas.horario_cierre.slice(0, 5)} h · devolución el mismo día, a más tardar a las{' '}
                {reglas.hora_limite_devolucion.slice(0, 5)} h.
              </p>
              <p>Cada préstamo dura {duracion(minutosPrestamo)}. La hora de devolución se calcula automáticamente.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fecha_retiro" className="mb-1 block text-sm font-medium text-slate-700">
                Fecha de retiro
              </label>
              <input
                id="fecha_retiro"
                type="date"
                min={hoy}
                value={fechaRetiro}
                onChange={(e) => setFechaRetiro(e.target.value)}
                aria-invalid={Boolean(errorFecha)}
                className={`${campo} ${errorFecha ? 'border-red-400' : ''}`}
              />
              {errorFecha && <p className="mt-1 text-xs text-red-700">{errorFecha}</p>}
            </div>
            <div>
              <label htmlFor="hora_retiro" className="mb-1 block text-sm font-medium text-slate-700">
                Hora de retiro
              </label>
              <select
                id="hora_retiro"
                value={horaValida ? horaRetiro : ''}
                onChange={(e) => setHoraRetiro(e.target.value)}
                disabled={!fechaRetiro || Boolean(errorFecha)}
                className={campo}
              >
                <option value="">{fechaRetiro ? 'Selecciona la hora' : 'Primero elige la fecha'}</option>
                {horas.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fecha_devolucion" className="mb-1 block text-sm font-medium text-slate-700">
                Fecha de devolución
              </label>
              <input id="fecha_devolucion" readOnly disabled value={horaValida ? fmtFecha(fechaRetiro) : ''} className={campo} />
            </div>
            <div>
              <label htmlFor="hora_devolucion" className="mb-1 block text-sm font-medium text-slate-700">
                Hora de devolución
              </label>
              <input id="hora_devolucion" readOnly disabled value={devolucion} className={campo} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="grupo" className="mb-1 block text-sm font-medium text-slate-700">
                Grupo
              </label>
              <input
                id="grupo"
                value={grupo}
                maxLength={6}
                onChange={(e) => setGrupo(e.target.value.toUpperCase())}
                placeholder="Ej. 6CV15"
                className={`${campo} sm:max-w-xs`}
              />
              <p className="mt-1 text-xs text-slate-400">{grupo.length}/6 caracteres</p>
            </div>
          </div>

          {/* Resultado de la verificación con el servidor */}
          <div className="mt-5" aria-live="polite">
            {listo && (verificando || !vigente) && (
              <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-guinda-700" /> Verificando disponibilidad...
              </p>
            )}
            {listo && !verificando && vigente?.valida && (
              <div className="flex items-center gap-3 rounded-lg border border-verde-600/30 bg-verde-50 p-3 text-verde-800">
                <span className="rounded-full bg-verde-700 p-1.5 text-white">
                  <Icono nombre="check" className="h-4 w-4" />
                </span>
                <div className="text-sm">
                  <p className="font-semibold">Horario disponible</p>
                  <p className="text-xs">
                    Préstamo de {duracion(minutosPrestamo)}: retiro a las {horaRetiro} h y devolución a las {devolucion} h.
                  </p>
                </div>
              </div>
            )}
            {listo && !verificando && vigente && !vigente.valida && (
              <Mensaje tipo="error" errores={vigente.errores.map((m) => ({ mensaje: m }))}>
                No se puede enviar la solicitud:
              </Mensaje>
            )}
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-4 w-4 accent-guinda-800" />
            <span>
              Acepto el <strong className="text-guinda-800">reglamento de préstamo</strong> del laboratorio y me comprometo a devolver los equipos en las
              condiciones en que los recibí.
            </span>
          </label>

          <p className="mt-4 flex gap-2 text-xs text-slate-500">
            <Icono nombre="alerta" className="h-4 w-4 shrink-0 text-amber-600" />
            La no cancelación a tiempo de equipos no requeridos se considera motivo de sanción.
          </p>
        </Tarjeta>

        <Tarjeta className="h-fit">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-verde-700">Equipos solicitados</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            {carrito.total} {carrito.total === 1 ? 'unidad' : 'unidades'}
          </h2>
          <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
            {grupos.map((g) => (
              <li key={g.nombre} className="flex gap-3 py-3">
                <FotoEquipo url={g.foto_url} nombre={g.nombre} className="h-10 w-12 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{g.nombre}</p>
                  {g.piezas.map((p) => {
                    const r = revisionDe(p.codigo_inventario)
                    return (
                      <p key={p.codigo_inventario} className={`text-xs ${r && !r.disponible ? 'text-red-700' : 'text-slate-500'}`}>
                        {p.codigo_inventario}
                        {r && !r.disponible && ` · ${r.motivo}`}
                      </p>
                    )
                  })}
                </div>
                <span className="text-sm font-semibold text-guinda-800">×{g.piezas.length}</span>
              </li>
            ))}
          </ul>

          {vigente?.valida && !verificando && (
            <div className="mt-4 flex gap-2 rounded-lg bg-verde-50 p-3 text-xs text-verde-800">
              <Icono nombre="check" className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Disponibilidad validada</p>
                <p>Los equipos están libres en ese horario.</p>
              </div>
            </div>
          )}

          {errorEnvio && (
            <div className="mt-4">
              <Mensaje tipo="error" errores={errorEnvio.errores}>
                {errorEnvio.message}
              </Mensaje>
            </div>
          )}

          <button type="submit" disabled={!puedeEnviar} className={`${boton.primario} mt-4 w-full py-3`}>
            {enviando ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Enviando...
              </>
            ) : (
              <>
                Enviar solicitud <Icono nombre="flecha" className="h-4 w-4" />
              </>
            )}
          </button>
          {!puedeEnviar && !enviando && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {!listo ? 'Completa la fecha, la hora y el grupo.' : !vigente?.valida ? 'Corrige lo marcado en rojo.' : !acepta ? 'Acepta el reglamento para continuar.' : ''}
            </p>
          )}
          <Link to="/estudiante/carrito" className={`${boton.secundario} mt-3 w-full`}>
            Volver al carrito
          </Link>
        </Tarjeta>
      </div>
    </form>
  )
}

/** Mensaje modal de confirmación con el folio (SRS 6.1). */
function Exito({ folio, navegar }) {
  return (
    <div>
      <Encabezado antetitulo="Solicitud de préstamo" titulo="Configura tu solicitud" derecha={<Pasos actual={4} />} />
      <Modal titulo="Solicitud enviada" sinCerrar>
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-verde-700 text-white ring-8 ring-verde-50">
            <Icono nombre="check" className="h-8 w-8" />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-verde-700">Solicitud registrada</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Tu solicitud está en revisión</h3>
          <p className="mt-2 text-sm text-slate-500">Recibirás un aviso cuando el laboratorio la apruebe o la rechace.</p>
          <div className="mt-5 rounded-xl bg-slate-100 p-4">
            <p className="text-xs text-slate-500">Folio de solicitud</p>
            <p className="mt-1 text-xl font-bold tracking-widest text-guinda-800">{folio}</p>
          </div>
          <button
            type="button"
            onClick={() => navegar('/estudiante/solicitudes', { state: { pestana: 'pendientes' } })}
            className={`${boton.primario} mt-5 w-full py-3`}
          >
            Ir a mis solicitudes <Icono nombre="flecha" className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => navegar(`/estudiante/solicitudes/${folio}`)} className="mt-3 text-sm font-medium text-guinda-800 hover:underline">
            Ver el detalle de la solicitud
          </button>
        </div>
      </Modal>
    </div>
  )
}
