// SRS 3.2: incidencias (retrasos, daños...) y sanciones con fecha de inicio y fin.
import { fecha, fechaHoraCorta } from '../utils/formato'
import EtiquetaEstado from './EtiquetaEstado'

export default function IncidenciasSanciones({ historial }) {
  if (!historial) return null
  const { incidencias, sanciones } = historial
  return (
    <div className="grid gap-6 border-t border-slate-200 p-5 lg:grid-cols-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Incidencias</h3>
        {incidencias.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin incidencias registradas.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {incidencias.map((i) => (
              <li key={i.id_incidencia} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">
                  {i.tipo} · <span className="text-verde-700">{i.folio_prestamo}</span>
                </p>
                <p className="text-xs text-slate-600">
                  {i.equipo ? `${i.equipo} (${i.codigo_inventario}) · ` : ''}
                  {i.descripcion}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {fechaHoraCorta(i.fecha_hora_registro)} · {i.resolucion}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Sanciones</h3>
        {sanciones.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin sanciones registradas.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {sanciones.map((s) => (
              <li key={s.id_sancion} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-800">{s.tipo ?? 'Sanción'}</p>
                  <EtiquetaEstado estado={s.estado === 'Vigente' ? 'Sancionado' : s.estado} />
                </div>
                <p className="text-xs text-slate-600">{s.motivo}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Del {fecha(s.fecha_inicio)} {s.fecha_fin ? `al ${fecha(s.fecha_fin)}` : '· indefinida'}
                </p>
                {s.motivo_condonacion && <p className="text-[11px] text-slate-500">Condonada: {s.motivo_condonacion}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
