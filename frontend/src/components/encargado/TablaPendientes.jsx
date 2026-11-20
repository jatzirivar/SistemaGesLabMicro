// Solicitudes Pendiente ordenadas por hora de retiro (SRS 8.1 y 8.18) con las acciones
// rápidas "Aprobar" (verde) y "Rechazar" (rojo, exige motivo del checklist: SRS 8.2).
// Cada equipo muestra si ya se devolvió y si está agendado en ese horario; si alguno está
// agendado por otra solicitud aprobada, no se puede aprobar y se sugiere "Equipo no disponible".
// La tabla se actualiza sola cada 5 segundos.
import { useState } from 'react'
import { api } from '../../api/cliente'
import useApi from '../../hooks/useApi'
import { fechaHoraCorta, hora } from '../../utils/formato'
import Cargando from '../Cargando'
import { Texto } from '../Formulario'
import Mensaje from '../Mensaje'
import Modal from '../Modal'
import { boton } from '../Pagina'

export default function TablaPendientes({ alCambiar }) {
  const { datos, error, cargando, recargar } = useApi('/encargado/solicitudes/pendientes', undefined, { cada: 5000 })
  const [ocupado, setOcupado] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [rechazar, setRechazar] = useState(null)

  const terminar = (texto, tipo = 'exito') => {
    setAviso({ texto, tipo })
    recargar()
    alCambiar?.()
  }

  const aprobar = async (folio) => {
    setOcupado(folio)
    setAviso(null)
    try {
      const r = await api(`/encargado/solicitudes/${encodeURIComponent(folio)}/aprobar`, { metodo: 'POST' })
      terminar(`${r.mensaje}. Se generó el PIN y se avisó al estudiante.`)
    } catch (e) {
      terminar(e.message, 'error')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div>
      {aviso && (
        <div className="px-5 pt-4">
          <Mensaje tipo={aviso.tipo}>{aviso.texto}</Mensaje>
        </div>
      )}
      {error && (
        <div className="p-5">
          <Mensaje tipo="error">{error}</Mensaje>
        </div>
      )}
      {cargando && <Cargando texto="Cargando solicitudes..." />}
      {datos && datos.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No hay solicitudes pendientes de aprobación.</p>}
      {datos && datos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Folio</th>
                <th className="px-3 py-2.5">Estudiante</th>
                <th className="px-3 py-2.5">Equipos</th>
                <th className="px-3 py-2.5">Retiro / devolución</th>
                <th className="px-5 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datos.map((s) => (
                <tr key={s.folio} className="align-top">
                  <td className="px-5 py-3">
                    <p className="whitespace-nowrap font-semibold text-verde-700">{s.folio}</p>
                    <p className="text-[11px] text-slate-400">Enviada {fechaHoraCorta(s.fecha_hora_solicitud)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-900">{s.estudiante}</p>
                    <p className="text-xs text-slate-500">{s.boleta}</p>
                    {s.alertas.map((a) => (
                      <p key={a} className="mt-1 inline-flex rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                        {a}
                      </p>
                    ))}
                  </td>
                  <td className="px-3 py-3">
                    <ul className="space-y-1.5">
                      {s.revision_equipos.map((e) => (
                        <li key={e.codigo_inventario} className="text-xs">
                          <p className="text-slate-700">
                            {e.nombre} <span className="text-slate-400">· {e.codigo_inventario}</span>
                          </p>
                          <p className={`flex items-center gap-1 font-medium ${COLOR_SITUACION[e.situacion]}`}>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                            {e.detalle}
                          </p>
                          {e.otras_pendientes.length > 0 && (
                            <p className="text-[11px] text-slate-500">También lo pide: {e.otras_pendientes.join(', ')}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                    <p>{fechaHoraCorta(s.fecha_hora_prog_retiro)}</p>
                    <p className="font-medium text-slate-800">hasta {hora(s.fecha_hora_limite_devolucion)} h</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={ocupado === s.folio || !s.puede_aprobar}
                        title={s.puede_aprobar ? undefined : 'Algún equipo ya está agendado en ese horario: recházala con «Equipo no disponible»'}
                        onClick={() => aprobar(s.folio)}
                        className="rounded-full border border-verde-600/40 bg-verde-50 px-3 py-1 text-xs font-semibold text-verde-700 hover:bg-verde-600/15 disabled:opacity-50"
                      >
                        {ocupado === s.folio ? 'Aprobando...' : 'Aprobar'}
                      </button>
                      <button
                        type="button"
                        disabled={ocupado === s.folio}
                        onClick={() => setRechazar(s)}
                        className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rechazar && (
        <ModalRechazo
          solicitud={rechazar}
          sugerido={rechazar.puede_aprobar ? null : EQUIPO_NO_DISPONIBLE}
          alCerrar={() => setRechazar(null)}
          alTerminar={(texto) => {
            setRechazar(null)
            terminar(texto)
          }}
        />
      )}
    </div>
  )
}

const EQUIPO_NO_DISPONIBLE = 1
const OTRO = 5

const COLOR_SITUACION = { libre: 'text-verde-700', aviso: 'text-amber-700', ocupado: 'text-red-700' }

function ModalRechazo({ solicitud, sugerido, alCerrar, alTerminar }) {
  const { datos: motivos } = useApi('/encargado/solicitudes/motivos-rechazo')
  const [motivo, setMotivo] = useState(sugerido)
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const valido = motivo && (motivo !== OTRO || detalle.trim().length > 0)

  const enviar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const r = await api(`/encargado/solicitudes/${encodeURIComponent(solicitud.folio)}/rechazar`, {
        metodo: 'POST',
        datos: { id_motivo_rechazo: motivo, detalle: motivo === OTRO ? detalle.trim() : null },
      })
      alTerminar(`${r.mensaje}. Se avisó al estudiante.`)
    } catch (e) {
      setError(e)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={`Rechazar ${solicitud.folio}`} alCerrar={alCerrar}>
      <p className="mb-3 text-sm text-slate-600">
        {solicitud.estudiante} ({solicitud.boleta}). Elige el motivo; se le notificará al estudiante.
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Motivo de rechazo</legend>
        {(motivos ?? []).map((m) => (
          <label key={m.id_motivo_rechazo} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${motivo === m.id_motivo_rechazo ? 'border-guinda-700 bg-guinda-50' : 'border-slate-200'}`}>
            <input type="radio" name="motivo" checked={motivo === m.id_motivo_rechazo} onChange={() => setMotivo(m.id_motivo_rechazo)} className="accent-guinda-800" />
            {m.motivo}
          </label>
        ))}
      </fieldset>
      {sugerido && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          Algún equipo ya está agendado en ese horario por otra solicitud aprobada.
        </p>
      )}
      {/* Solo "Otro" pide escribir el motivo (SRS 8.2) */}
      {motivo === OTRO && (
        <Texto
          id="detalle_rechazo"
          className="mt-4"
          etiqueta="Especifica el motivo"
          value={detalle}
          maxLength={255}
          onChange={(e) => setDetalle(e.target.value)}
        />
      )}
      {error && (
        <div className="mt-3">
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className={boton.secundario} onClick={alCerrar} disabled={enviando}>
          Cancelar
        </button>
        <button type="button" className={boton.peligro} onClick={enviar} disabled={!valido || enviando}>
          {enviando ? 'Rechazando...' : 'Rechazar solicitud'}
        </button>
      </div>
    </Modal>
  )
}
