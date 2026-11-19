// Pantalla 8: Panel operativo del encargado (SRS 8). Versión provisional: muestra los
// contadores para comprobar la conexión con el API. El diseño completo se arma en el paso 5.
import { useEffect, useState } from 'react'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import Mensaje from '../../components/Mensaje'
import { useAuth } from '../../context/AuthContext'

export default function PanelEncargado() {
  const { usuario } = useAuth()
  const [panel, setPanel] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    api('/encargado/panel')
      .then((datos) => activo && setPanel(datos))
      .catch((e) => activo && setError(e.message))
    return () => {
      activo = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-slate-900">¿Qué haremos hoy, {usuario?.nombre}?</h1>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!panel && !error && <Cargando texto="Cargando contadores..." />}

      {panel && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Contador titulo="Pendientes" numero={panel.solicitudes_pendientes} detalle="Solicitudes en revisión" color="text-amber-600" />
            <Contador titulo="Entregados" numero={panel.prestamos_entregados} detalle="Préstamos activos" color="text-verde-600" />
            <Contador titulo="Vencidos" numero={panel.prestamos_vencidos} detalle="Sin devolver a tiempo" color="text-red-600" />
            <Contador
              titulo="Bajo stock"
              numero={panel.categorias_bajo_stock.length}
              detalle="Categorías con menos de 2 disponibles"
              color="text-red-600"
            />
            <Contador titulo="Entregas del día" numero={panel.entregas_del_dia} detalle="Aprobadas con retiro hoy" color="text-slate-800" />
            <Contador titulo="Devoluciones del día" numero={panel.devoluciones_del_dia} detalle="Deben devolverse hoy" color="text-slate-800" />
            <Contador titulo="Con pendientes" numero={panel.prestamos_con_pendientes} detalle="Devueltos con incidencias" color="text-red-600" />
          </div>
          <Mensaje tipo="info">Conexión con el servidor correcta. El panel completo se construye en el paso 5.</Mensaje>
        </>
      )}
    </div>
  )
}

function Contador({ titulo, numero, detalle, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{numero}</p>
      <p className="mt-1 text-xs text-slate-500">{detalle}</p>
    </div>
  )
}
