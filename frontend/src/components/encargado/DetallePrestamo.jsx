// Detalle de un préstamo para el encargado (sin PIN): equipos, fechas, línea de tiempo,
// observaciones e incidencias. Se abre desde la ficha del alumno y desde el Historial.
import useApi from '../../hooks/useApi'
import { fechaHora, fechaHoraCorta } from '../../utils/formato'
import Cargando from '../Cargando'
import EtiquetaEstado from '../EtiquetaEstado'
import Mensaje from '../Mensaje'
import Modal from '../Modal'

export default function DetallePrestamo({ folio, alCerrar }) {
  const { datos: p, error } = useApi(`/ventanilla/prestamos/${encodeURIComponent(folio)}`)
  return (
    <Modal titulo={`Préstamo ${folio}`} alCerrar={alCerrar} ancho="max-w-2xl">
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!p && !error && <Cargando texto="Cargando préstamo..." />}
      {p && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-slate-700">
              {p.estudiante} · {p.boleta} · Grupo {p.grupo}
            </p>
            <EtiquetaEstado estado={p.estado} />
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Dato t="Solicitud" v={fechaHora(p.fecha_hora_solicitud)} />
            <Dato t="Retiro programado" v={fechaHora(p.fecha_hora_prog_retiro)} />
            <Dato t={p.prorroga ? 'Devolución (con prórroga)' : 'Devolución límite'} v={fechaHora(p.fecha_hora_limite_devolucion)} />
            {p.fecha_hora_real_entrega && <Dato t="Entregado" v={fechaHora(p.fecha_hora_real_entrega)} />}
            {p.fecha_hora_real_devolucion && <Dato t="Devuelto" v={fechaHora(p.fecha_hora_real_devolucion)} />}
          </dl>
          {p.motivo_rechazo && <Mensaje tipo="error">Motivo de rechazo: {p.motivo_rechazo}</Mensaje>}
          {p.motivo_cancelacion && <Mensaje tipo="info">Motivo de cancelación: {p.motivo_cancelacion}</Mensaje>}
          <div>
            <h3 className="mb-1 font-semibold text-slate-900">Equipos</h3>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {p.equipos.map((e) => (
                <li key={e.codigo_inventario} className="px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {e.nombre} · <span className="font-mono text-xs">{e.codigo_inventario}</span>
                    </span>
                    {e.inspeccion_devolucion && <EtiquetaEstado estado={e.inspeccion_devolucion} />}
                  </div>
                  {e.entregado_completo === false && <p className="text-xs text-amber-700">Se entregó incompleto.</p>}
                  {e.obs_entrega && <p className="text-xs text-slate-500">Entrega: {e.obs_entrega}</p>}
                  {e.obs_devolucion && <p className="text-xs text-slate-500">Devolución: {e.obs_devolucion}</p>}
                </li>
              ))}
            </ul>
          </div>
          {p.incidencias.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold text-slate-900">Incidencias</h3>
              <ul className="space-y-1">
                {p.incidencias.map((i) => (
                  <li key={i.id_incidencia} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    <strong>{i.tipo}</strong>
                    {i.codigo_inventario ? ` · ${i.codigo_inventario}` : ''}: {i.descripcion} — {i.resolucion}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="mb-1 font-semibold text-slate-900">Línea de tiempo</h3>
            <ol className="space-y-1 text-xs text-slate-600">
              {p.linea_de_tiempo.map((ev) => (
                <li key={`${ev.estado}-${ev.fecha_hora}`}>
                  <strong className="text-slate-800">{ev.estado}</strong> · {fechaHoraCorta(ev.fecha_hora)}
                  {ev.descripcion ? ` · ${ev.descripcion}` : ''}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Dato({ t, v }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{t}</dt>
      <dd className="font-medium text-slate-900">{v}</dd>
    </div>
  )
}
