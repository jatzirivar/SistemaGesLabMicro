// Campana de avisos del encargado. Los avisos los calcula el servidor al momento
// (no se guardan en la BD); lo leído se recuerda en este navegador.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/cliente'
import { useAuth } from '../context/AuthContext'
import { ListaAvisos } from './AccionesEstudiante'
import { useCerrarAlSalir } from './BarraSuperior'
import Icono from './Icono'

// A qué pestaña de "Solicitudes" lleva cada tipo de aviso
const DESTINO = { Pendiente: 'pendientes', Retiro: 'entrega', Vencido: 'devolucion', Devolucion: 'devolucion', Pendientes: 'devolucion' }

function leerLeidos(llave) {
  try {
    return new Set(JSON.parse(localStorage.getItem(llave) ?? '[]'))
  } catch {
    return new Set()
  }
}

export default function AccionesEncargado() {
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const llave = `sgpl_avisos_leidos_enc_${usuario?.id}`
  const [avisos, setAvisos] = useState([])
  const [leidos, setLeidos] = useState(() => leerLeidos(llave))
  const [abierto, setAbierto] = useState(false)
  const ref = useCerrarAlSalir(abierto, () => setAbierto(false))

  const cargar = useCallback(() => {
    api('/encargado/avisos')
      .then(setAvisos)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const primera = setTimeout(cargar, 0)
    const id = setInterval(cargar, 60_000)
    return () => {
      clearTimeout(primera)
      clearInterval(id)
    }
  }, [cargar])

  const guardar = (nuevos) => {
    // Solo se conservan los ids de avisos que siguen existiendo
    const vigentes = new Set([...nuevos].filter((id) => avisos.some((a) => a.id === id)))
    setLeidos(vigentes)
    try {
      localStorage.setItem(llave, JSON.stringify([...vigentes]))
    } catch {
      // Sin espacio: se recuerda solo mientras la página esté abierta
    }
  }

  const lista = avisos.map((a) => ({
    id_notificacion: a.id,
    titulo: a.titulo,
    mensaje: a.mensaje,
    folio_prestamo: a.folio,
    fecha_hora_generacion: a.fecha_hora,
    leida: leidos.has(a.id),
    tipo: a.tipo,
  }))
  const noLeidas = lista.filter((a) => !a.leida).length

  const abrir = (a) => {
    setAbierto(false)
    guardar(new Set([...leidos, a.id_notificacion]))
    navegar('/encargado/solicitudes', { state: { pestana: DESTINO[a.tipo] ?? 'pendientes', folio: a.folio_prestamo, vez: Date.now() } })
  }

  return (
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
        {noLeidas > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white ring-2 ring-guinda-800">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>
      {abierto && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-700 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Avisos</p>
            {noLeidas > 0 && (
              <button type="button" onClick={() => guardar(new Set(avisos.map((a) => a.id)))} className="text-xs font-medium text-guinda-800 hover:underline">
                Marcar todos como leídos
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <ListaAvisos avisos={lista} alAbrir={abrir} vacio="No hay avisos por ahora." />
          </div>
        </div>
      )}
    </div>
  )
}
