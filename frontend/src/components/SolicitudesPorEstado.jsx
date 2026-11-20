// Solicitudes del estudiante en tres pestañas (SRS 3.1): en curso, en revisión y finalizadas.
// Cada registro muestra folio, equipos, fechas clave y su etiqueta de color.
import { Link } from 'react-router-dom'
import { fechaHoraCorta } from '../utils/formato'
import EtiquetaEstado from './EtiquetaEstado'
import Icono from './Icono'

export const PESTANAS = [
  { id: 'activos', grupo: 'en_curso', texto: 'Activos', vacio: 'No tienes préstamos en curso.' },
  { id: 'pendientes', grupo: 'en_revision', texto: 'Pendientes', vacio: 'No tienes solicitudes en revisión.' },
  { id: 'historial', grupo: 'finalizadas', texto: 'Historial', vacio: 'Aún no tienes solicitudes finalizadas.' },
]

export function FilaSolicitud({ s }) {
  const [primero, ...resto] = s.equipos
  return (
    <li className="grid gap-x-4 gap-y-2 px-5 py-4 lg:grid-cols-[9.5rem_1fr_12rem_8rem_6rem] lg:items-center">
      <Link to={`/estudiante/solicitudes/${s.folio}`} className="text-sm font-semibold text-verde-700 hover:underline">
        {s.folio}
      </Link>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {primero?.nombre}
          {resto.length > 0 && <span className="font-normal text-slate-500"> y {resto.length} más</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{s.equipos.map((e) => e.codigo_inventario).join(' · ')}</p>
      </div>
      <div className="text-xs text-slate-500">
        <p>Retiro: {fechaHoraCorta(s.fecha_hora_prog_retiro)}</p>
        <p className="font-medium text-slate-800">Devolución: {fechaHoraCorta(s.fecha_hora_limite_devolucion)}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        <EtiquetaEstado estado={s.estado} />
        {s.proximo_a_vencer && <EtiquetaEstado estado="Próximo a vencer" />}
      </div>
      <Link
        to={`/estudiante/solicitudes/${s.folio}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-verde-700 hover:underline lg:justify-self-end"
      >
        Ver detalle <Icono nombre="flecha" className="h-3.5 w-3.5" />
      </Link>
    </li>
  )
}

/** datos = respuesta de GET /solicitudes. `pestana` y `alCambiar` controlan la pestaña activa. */
export default function SolicitudesPorEstado({ datos, pestana, alCambiar, limite }) {
  const actual = PESTANAS.find((p) => p.id === pestana) ?? PESTANAS[0]
  const lista = datos[actual.grupo]
  const visibles = limite ? lista.slice(0, limite) : lista

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 px-3">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === actual.id}
            onClick={() => alCambiar(p.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
              p.id === actual.id ? 'border-guinda-800 text-guinda-800' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {p.texto}
            <span className={`rounded-full px-2 text-xs ${p.id === actual.id ? 'bg-guinda-100 text-guinda-800' : 'bg-slate-100 text-slate-500'}`}>
              {datos[p.grupo].length}
            </span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">{actual.vacio}</p>
      ) : (
        <>
          <div className="hidden grid-cols-[9.5rem_1fr_12rem_8rem_6rem] gap-x-4 bg-slate-50 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
            <span>Folio</span>
            <span>Equipo</span>
            <span>Retiro / devolución</span>
            <span>Estado</span>
            <span className="text-right">Acción</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {visibles.map((s) => (
              <FilaSolicitud key={s.folio} s={s} />
            ))}
          </ul>
        </>
      )}
      {limite && lista.length > limite && (
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Mostrando {limite} de {lista.length}.
        </p>
      )}
    </div>
  )
}
