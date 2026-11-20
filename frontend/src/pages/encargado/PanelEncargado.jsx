// Pantalla 8: Panel operativo del encargado (SRS 8 y 8.1).
// 6 contadores, tabla de solicitudes pendientes con Aprobar/Rechazar,
// devoluciones del día y categorías con bajo stock.
import { Link, useNavigate } from 'react-router-dom'
import Cargando from '../../components/Cargando'
import TablaPendientes from '../../components/encargado/TablaPendientes'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import { Tarjeta } from '../../components/Pagina'
import { useAuth } from '../../context/AuthContext'
import useApi from '../../hooks/useApi'
import { hora, hoyLargo } from '../../utils/formato'

const COLORES = {
  amber: 'bg-amber-50 text-amber-700',
  verde: 'bg-verde-50 text-verde-700',
  rojo: 'bg-red-50 text-red-700',
  guinda: 'bg-guinda-50 text-guinda-800',
}

export default function PanelEncargado() {
  const { usuario } = useAuth()
  const navegar = useNavigate()
  const { datos: panel, error, recargar } = useApi('/encargado/panel')

  return (
    <div>
      <div className="mb-4 flex justify-end text-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <Icono nombre="calendario" className="h-4 w-4" /> {hoyLargo()}
        </span>
      </div>
      <div className="mb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-verde-700">Laboratorio de Microprocesadores</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">¿Qué haremos hoy, {usuario?.nombre}?</h1>
        <p className="mt-1 text-sm text-slate-500">Panel operativo del laboratorio.</p>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!panel && !error && <Cargando texto="Cargando contadores..." />}

      {panel && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Contador icono="reloj" color="amber" titulo="Solicitudes pendientes" numero={panel.solicitudes_pendientes} detalle="Por aprobar o rechazar" />
            <Contador icono="entrega" color="verde" titulo="Préstamos entregados" numero={panel.prestamos_entregados} detalle="Equipo fuera del laboratorio" />
            <Contador icono="alerta" color="rojo" titulo="Préstamos vencidos" numero={panel.prestamos_vencidos} detalle="Sin devolver a tiempo" />
            <Contador icono="calendario" color="guinda" titulo="Entregas del día" numero={panel.entregas_del_dia} detalle="Aprobadas con retiro hoy" />
            <Contador icono="devolucion" color="guinda" titulo="Devoluciones del día" numero={panel.devoluciones_del_dia} detalle="Deben devolverse hoy" />
            <Contador icono="caja" color="rojo" titulo="Bajo stock" numero={panel.categorias_bajo_stock.length} detalle="Categorías con menos de 2 disponibles" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Tarjeta className="!p-0 min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Solicitudes pendientes</h2>
                  <p className="text-xs text-slate-500">Ordenadas por hora de retiro, de la más próxima a la más lejana.</p>
                </div>
                <Link to="/encargado/solicitudes" className="inline-flex items-center gap-1 text-sm font-semibold text-verde-700 hover:underline">
                  Ir a Solicitudes <Icono nombre="flecha" className="h-4 w-4" />
                </Link>
              </div>
              <TablaPendientes alCambiar={recargar} />
            </Tarjeta>

            <div className="space-y-6">
              <Tarjeta>
                <h2 className="text-base font-semibold text-slate-900">Devoluciones del día</h2>
                {panel.devoluciones_hoy.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No hay devoluciones pendientes para hoy.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {panel.devoluciones_hoy.map((d) => (
                      <li key={d.folio}>
                        <button
                          type="button"
                          onClick={() => navegar('/encargado/solicitudes', { state: { pestana: 'devolucion', folio: d.folio, vez: Date.now() } })}
                          className="flex w-full items-start gap-3 rounded-lg p-1 text-left hover:bg-slate-50"
                        >
                          <Icono nombre="reloj" className="mt-0.5 h-5 w-5 shrink-0 text-verde-700" />
                          <span>
                            <span className="block text-sm font-semibold text-verde-700">{d.folio}</span>
                            <span className="block text-xs text-slate-600">
                              {d.estudiante} · {hora(d.fecha_hora_limite_devolucion)} h
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>

              <Tarjeta>
                <h2 className="text-base font-semibold text-slate-900">Alertas de bajo stock</h2>
                {panel.categorias_bajo_stock.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Todas las categorías tienen 2 o más equipos disponibles.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {panel.categorias_bajo_stock.map((c) => (
                      <li key={c.id_categoria} className="flex gap-3">
                        <Icono nombre="alerta" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{c.nombre}</span>
                          <span className="block text-xs text-slate-600">
                            {c.disponibles} de {c.total_equipos} disponibles
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Contador({ icono, color, titulo, numero, detalle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <span className={`rounded-lg p-1.5 ${COLORES[color]}`}>
          <Icono nombre={icono} className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold leading-tight text-slate-800">{titulo}</p>
      </div>
      <p className={`mt-3 text-3xl font-bold ${COLORES[color].split(' ')[1]}`}>{numero}</p>
      <p className="mt-1 text-xs text-slate-500">{detalle}</p>
    </div>
  )
}
