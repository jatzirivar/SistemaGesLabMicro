// Pantalla 7: Detalle de la solicitud (SRS 7, 7.1, 7.2, 7.3, 6.2, 6.3 y 3.5).
// Muestra PIN (solo Aprobada), material, fechas, línea de tiempo, observaciones,
// motivo de rechazo o cancelación, y las acciones permitidas.
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, descargar } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import EtiquetaEstado from '../../components/EtiquetaEstado'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Tarjeta } from '../../components/Pagina'
import { useAvisos } from '../../context/AvisosContext'
import { useCarrito } from '../../context/CarritoContext'
import { duracion, fecha, fechaHora } from '../../utils/formato'

const PENDIENTE = 1
const APROBADA = 2
const ENTREGADA = 3

export default function DetalleSolicitud() {
  const { pathname } = useLocation()
  const folio = decodeURIComponent(pathname.split('/').filter(Boolean).at(-1))
  const { recargar: recargarAvisos } = useAvisos()
  const { reglas } = useCarrito()
  const [s, setS] = useState(null)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // 'cancelar' | 'prorroga' | 'comprobante'
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(() => {
    api(`/solicitudes/${encodeURIComponent(folio)}`)
      .then((d) => {
        setS(d)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }, [folio])

  useEffect(() => {
    const id = setTimeout(cargar, 0)
    return () => clearTimeout(id)
  }, [cargar])

  const alTerminar = (nuevo, texto) => {
    setS(nuevo)
    setModal(null)
    setAviso(texto)
    recargarAvisos()
  }

  if (error && !s) {
    return (
      <div>
        <Mensaje tipo="error">{error}</Mensaje>
        <Link to="/estudiante/solicitudes" className={`${boton.secundario} mt-4`}>
          Volver a mis solicitudes
        </Link>
      </div>
    )
  }
  if (!s) return <Cargando texto="Cargando solicitud..." />

  const conComprobante = [APROBADA, ENTREGADA].includes(s.id_estado_prestamo)
  const verAviso = [PENDIENTE, APROBADA].includes(s.id_estado_prestamo)
  const entregados = s.id_estado_prestamo >= ENTREGADA && s.fecha_hora_real_entrega

  return (
    <div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-verde-700">Solicitud de préstamo</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{s.folio}</h1>
          <p className="mt-1 text-sm text-verde-700">
            Fecha de solicitud: {fecha(s.fecha_hora_solicitud)} · Grupo: {s.grupo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EtiquetaEstado estado={s.estado} grande />
          {s.proximo_a_vencer && <EtiquetaEstado estado="Próximo a vencer" grande />}
        </div>
      </div>

      {aviso && (
        <div className="mb-6">
          <Mensaje tipo="exito">{aviso}</Mensaje>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {/* PIN para ventanilla: solo mientras está Aprobada (SRS 7.1) */}
          {s.codigo_pin && (
            <section className="rounded-2xl border border-guinda-100 bg-guinda-50 p-6 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
                <Icono nombre="llave" className="h-4 w-4 text-guinda-800" /> Tu PIN de validación para ventanilla es:
              </p>
              <p className="my-3 font-mono text-5xl font-bold tracking-[0.4em] text-guinda-900" aria-label={`PIN ${s.codigo_pin.split('').join(' ')}`}>
                {s.codigo_pin}
              </p>
              <p className="text-xs text-slate-600">Muestra este código al encargado del laboratorio para recoger tu material.</p>
            </section>
          )}

          {s.id_estado_prestamo === 6 && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <h2 className="text-lg font-semibold text-red-800">Motivo de rechazo</h2>
              <p className="mt-2 text-sm text-red-900">{s.motivo_rechazo ?? 'Sin motivo registrado.'}</p>
            </section>
          )}

          {s.id_estado_prestamo === 7 && (
            <section className="rounded-2xl border border-slate-200 bg-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800">Motivo de cancelación</h2>
              <p className="mt-2 text-sm text-slate-700">{s.motivo_cancelacion ?? 'Sin motivo registrado.'}</p>
            </section>
          )}

          <Tarjeta>
            <h2 className="text-lg font-semibold text-slate-900">{s.id_estado_prestamo >= APROBADA && s.id_estado_prestamo <= 5 ? 'Material asignado' : 'Material solicitado'}</h2>
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {s.equipos.map((e) => (
                <li key={e.codigo_inventario} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{e.nombre}</p>
                      <p className="text-xs text-slate-500">
                        Código: {e.codigo_inventario} · {e.categoria}
                      </p>
                    </div>
                    {e.inspeccion_devolucion && <EtiquetaEstado estado={e.inspeccion_devolucion} />}
                  </div>
                  {/* Observaciones del encargado (SRS 7) */}
                  {(e.obs_entrega || e.entregado_completo === false || e.obs_devolucion) && (
                    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {e.entregado_completo === false && <p>Se entregó incompleto.</p>}
                      {e.obs_entrega && <p>Observación de entrega: {e.obs_entrega}</p>}
                      {e.obs_devolucion && <p>Observación de devolución: {e.obs_devolucion}</p>}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-sm font-semibold text-slate-900">Hora de retiro y devolución</h3>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <Dato titulo="Retiro programado" valor={fechaHora(s.fecha_hora_prog_retiro)} />
              <Dato titulo={s.prorroga ? 'Devolución (con prórroga)' : 'Devolución límite'} valor={fechaHora(s.fecha_hora_limite_devolucion)} />
              {entregados && <Dato titulo="Entregado en ventanilla" valor={fechaHora(s.fecha_hora_real_entrega)} />}
              {s.fecha_hora_real_devolucion && <Dato titulo="Devuelto" valor={fechaHora(s.fecha_hora_real_devolucion)} />}
            </dl>
          </Tarjeta>

          {verAviso && (
            <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />
              {s.aviso}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {conComprobante && (
              <button type="button" className={boton.primario} onClick={() => setModal('comprobante')}>
                <Icono nombre="documento" className="h-4 w-4" /> Ver comprobante
              </button>
            )}
            {s.puede_solicitar_prorroga && (
              <button type="button" className={boton.verde} onClick={() => setModal('prorroga')}>
                <Icono nombre="reloj" className="h-4 w-4" /> Solicitar prórroga
              </button>
            )}
            {s.puede_cancelar && (
              <button type="button" className={boton.secundario} onClick={() => setModal('cancelar')}>
                Cancelar solicitud
              </button>
            )}
          </div>
        </div>

        <Tarjeta className="h-fit">
          <h2 className="text-lg font-semibold text-slate-900">Línea de tiempo</h2>
          <ol className="mt-4 space-y-0">
            {s.linea_de_tiempo.map((ev, i) => (
              <li key={`${ev.estado}-${ev.fecha_hora}`} className="relative flex gap-3 pb-5 last:pb-0">
                {i < s.linea_de_tiempo.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" aria-hidden="true" />}
                <span className={`relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${i === s.linea_de_tiempo.length - 1 ? 'border-guinda-800 bg-guinda-800' : 'border-slate-300 bg-white'}`} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{ev.estado}</p>
                  <p className="text-xs text-slate-500">{fechaHora(ev.fecha_hora)}</p>
                  {ev.descripcion && <p className="mt-0.5 text-xs text-slate-600">{ev.descripcion}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Tarjeta>
      </div>

      {modal === 'cancelar' && <ModalCancelar folio={s.folio} alCerrar={() => setModal(null)} alTerminar={(d) => alTerminar(d, 'Solicitud cancelada. Los equipos quedaron disponibles.')} />}
      {modal === 'prorroga' && (
        <ModalProrroga
          folio={s.folio}
          minutos={reglas?.duracion_prorroga ?? 60}
          alCerrar={() => setModal(null)}
          alTerminar={(d) => alTerminar(d, `Prórroga autorizada. Nueva hora de devolución: ${fechaHora(d.fecha_hora_limite_devolucion)}.`)}
        />
      )}
      {modal === 'comprobante' && <ModalComprobante folio={s.folio} alCerrar={() => setModal(null)} />}
    </div>
  )
}

function Dato({ titulo, valor }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{titulo}</dt>
      <dd className="font-medium text-slate-900">{valor}</dd>
    </div>
  )
}

/** Hace una acción POST y muestra el error dentro del modal si falla. */
function useAccion(ruta, alTerminar) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const ejecutar = async () => {
    setEnviando(true)
    setError(null)
    try {
      alTerminar(await api(ruta, { metodo: 'POST' }))
    } catch (e) {
      setError(e)
      setEnviando(false)
    }
  }
  return { enviando, error, ejecutar }
}

/** SRS 6.3: advertencia y botones "Confirmar cancelación" / "Volver / No cancelar". */
function ModalCancelar({ folio, alCerrar, alTerminar }) {
  const { enviando, error, ejecutar } = useAccion(`/solicitudes/${encodeURIComponent(folio)}/cancelar`, alTerminar)
  return (
    <Modal titulo="Cancelar solicitud" alCerrar={alCerrar}>
      <p className="text-sm text-slate-600">
        ¿Estás seguro de que deseas cancelar esta solicitud? Los equipos apartados quedarán disponibles para otros estudiantes.
      </p>
      {error && (
        <div className="mt-4">
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className={boton.secundario} onClick={alCerrar} disabled={enviando}>
          Volver / No cancelar
        </button>
        <button type="button" className={boton.peligro} onClick={ejecutar} disabled={enviando}>
          {enviando ? 'Cancelando...' : 'Confirmar cancelación'}
        </button>
      </div>
    </Modal>
  )
}

/** SRS 6.3 (renovación): una sola extensión de 1 hora. */
function ModalProrroga({ folio, minutos, alCerrar, alTerminar }) {
  const { enviando, error, ejecutar } = useAccion(`/solicitudes/${encodeURIComponent(folio)}/prorroga`, alTerminar)
  return (
    <Modal titulo="Solicitar prórroga" alCerrar={alCerrar}>
      <p className="text-sm text-slate-600">
        Tu hora de devolución se extenderá {duracion(minutos)}. Solo puedes pedir una prórroga por préstamo y se autoriza si los equipos no tienen otra reserva
        después.
      </p>
      {error && (
        <div className="mt-4">
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className={boton.secundario} onClick={alCerrar} disabled={enviando}>
          Volver
        </button>
        <button type="button" className={boton.primario} onClick={ejecutar} disabled={enviando}>
          {enviando ? 'Solicitando...' : 'Confirmar prórroga'}
        </button>
      </div>
    </Modal>
  )
}

/** SRS 7.3 (vista tipo comprobante) y 7.2 (descarga en PDF). */
function ModalComprobante({ folio, alCerrar }) {
  const [c, setC] = useState(null)
  const [error, setError] = useState(null)
  const [descargando, setDescargando] = useState(false)

  useEffect(() => {
    api(`/solicitudes/${encodeURIComponent(folio)}/comprobante`).then(setC).catch((e) => setError(e.message))
  }, [folio])

  const bajar = async () => {
    setDescargando(true)
    setError(null)
    try {
      await descargar(`/solicitudes/${encodeURIComponent(folio)}/comprobante/pdf`, `comprobante_${folio}.pdf`)
    } catch (e) {
      setError(e.message)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Modal titulo="Comprobante de retiro" alCerrar={alCerrar}>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!c && !error && <Cargando texto="Cargando comprobante..." />}
      {c && (
        <div className="rounded-xl border-2 border-dashed border-slate-300 p-5 text-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-guinda-800">ESIME Culhuacán · Lab. de Microprocesadores</p>
              <p className="text-lg font-bold text-slate-900">{c.folio}</p>
            </div>
            <EtiquetaEstado estado={c.estado} />
          </div>
          <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1.5">
            <dt className="text-slate-500">Estudiante</dt>
            <dd className="font-medium">{c.estudiante}</dd>
            <dt className="text-slate-500">Boleta</dt>
            <dd className="font-medium">{c.boleta}</dd>
            <dt className="text-slate-500">Grupo</dt>
            <dd className="font-medium">{c.grupo}</dd>
            <dt className="text-slate-500">Retiro</dt>
            <dd className="font-medium">{fechaHora(c.fecha_hora_retiro)}</dd>
            <dt className="text-slate-500">Devolución</dt>
            <dd className="font-medium">{fechaHora(c.fecha_hora_devolucion)}</dd>
          </dl>
          <p className="mt-3 text-slate-500">Equipos</p>
          <ul className="mt-1 space-y-1">
            {c.equipos.map((e) => (
              <li key={e.codigo_inventario} className="flex justify-between gap-2 rounded bg-slate-50 px-2 py-1">
                <span>{e.nombre}</span>
                <span className="font-mono text-xs text-slate-600">{e.codigo_inventario}</span>
              </li>
            ))}
          </ul>
          {c.codigo_pin && (
            <p className="mt-4 rounded-lg bg-guinda-50 px-3 py-2 text-center">
              PIN de ventanilla: <strong className="font-mono text-lg tracking-widest text-guinda-900">{c.codigo_pin}</strong>
            </p>
          )}
        </div>
      )}
      {c && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Por seguridad, el PDF no incluye el PIN.</p>
          <button type="button" className={boton.primario} onClick={bajar} disabled={descargando}>
            <Icono nombre="descargar" className="h-4 w-4" /> {descargando ? 'Descargando...' : 'Descargar PDF'}
          </button>
        </div>
      )}
    </Modal>
  )
}
