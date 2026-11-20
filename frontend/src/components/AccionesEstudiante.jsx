// Botones del encabezado del estudiante: campana de avisos (SRS 3.4) y carrito con
// contador global de equipos seleccionados (SRS 4.1).
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAvisos } from '../context/AvisosContext'
import { useCarrito } from '../context/CarritoContext'
import { fechaHoraCorta } from '../utils/formato'
import { useCerrarAlSalir } from './BarraSuperior'
import Icono from './Icono'

function Contador({ valor, color }) {
  if (!valor) return null
  return (
    <span className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ring-2 ring-guinda-800 ${color}`}>
      {valor > 99 ? '99+' : valor}
    </span>
  )
}

export function ListaAvisos({ avisos, alAbrir, vacio = 'No tienes avisos.' }) {
  if (avisos.length === 0) return <p className="px-4 py-6 text-center text-sm text-slate-500">{vacio}</p>
  return (
    <ul className="divide-y divide-slate-100">
      {avisos.map((n) => (
        <li key={n.id_notificacion}>
          <button
            type="button"
            onClick={() => alAbrir(n)}
            className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.leida ? '' : 'bg-guinda-50/50'}`}
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.leida ? 'bg-transparent' : 'bg-guinda-700'}`} aria-hidden="true" />
            <span className="min-w-0">
              <span className={`block text-sm ${n.leida ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{n.titulo}</span>
              <span className="mt-0.5 block text-xs text-slate-600">{n.mensaje}</span>
              <span className="mt-1 block text-[11px] text-slate-400">
                {fechaHoraCorta(n.fecha_hora_generacion)}
                {!n.leida && ' · Sin leer'}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Marca el aviso como leído y, si es de una solicitud, abre su detalle. */
export function useAbrirAviso() {
  const { marcarLeida } = useAvisos()
  const navegar = useNavigate()
  return (n) => {
    if (!n.leida) marcarLeida(n.id_notificacion)
    if (n.folio_prestamo) navegar(`/estudiante/solicitudes/${n.folio_prestamo}`)
  }
}

export default function AccionesEstudiante() {
  const { lista, noLeidas, marcarTodas } = useAvisos()
  const { total } = useCarrito()
  const [abierto, setAbierto] = useState(false)
  const ref = useCerrarAlSalir(abierto, () => setAbierto(false))
  const abrirAviso = useAbrirAviso()

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          title="Avisos"
          aria-label={`Avisos${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
          className="relative rounded-full p-2 hover:bg-white/10"
        >
          <Icono nombre="campana" className="h-5 w-5" />
          <Contador valor={noLeidas} color="bg-amber-500" />
        </button>
        {abierto && (
          <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-700 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-slate-900">Avisos</p>
              {noLeidas > 0 && (
                <button type="button" onClick={marcarTodas} className="text-xs font-medium text-guinda-800 hover:underline">
                  Marcar todos como leídos
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              <ListaAvisos
                avisos={lista.slice(0, 15)}
                alAbrir={(n) => {
                  setAbierto(false)
                  abrirAviso(n)
                }}
              />
            </div>
          </div>
        )}
      </div>

      <Link to="/estudiante/carrito" title="Carrito" aria-label={`Carrito, ${total} equipos`} className="relative rounded-lg border border-white/20 p-2 hover:bg-white/10">
        <Icono nombre="carrito" className="h-5 w-5" />
        <Contador valor={total} color="bg-verde-600" />
      </Link>
    </>
  )
}
