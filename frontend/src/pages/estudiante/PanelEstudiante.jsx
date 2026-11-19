// Pantalla 3: Panel del estudiante (SRS 3). Versión provisional: muestra los contadores
// para comprobar la conexión con el API. El diseño completo se arma en el paso 4.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import Mensaje from '../../components/Mensaje'
import { useAuth } from '../../context/AuthContext'

export default function PanelEstudiante() {
  const { usuario } = useAuth()
  const [panel, setPanel] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    api('/estudiante/panel')
      .then((datos) => activo && setPanel(datos))
      .catch((e) => activo && setError(e.message))
    return () => {
      activo = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">¿Qué haremos hoy, {usuario?.nombre}?</h1>
          <p className="mt-1 text-sm text-slate-500">Consulta tus solicitudes y mantén tus devoluciones al día.</p>
        </div>
        <Link
          to="/estudiante/catalogo"
          className="rounded-lg bg-guinda-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-guinda-900"
        >
          + Explorar catálogo
        </Link>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!panel && !error && <Cargando texto="Cargando tu panel..." />}

      {panel && (
        <>
          {panel.alertas.length > 0 && (
            <Mensaje tipo="error" errores={panel.alertas.map((a) => ({ mensaje: a }))}>
              No puedes solicitar equipo por ahora:
            </Mensaje>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Tarjeta numero={panel.prestamos_activos.length} titulo="Préstamos activos" />
            <Tarjeta numero={panel.solicitudes_pendientes} titulo="Solicitudes en revisión" />
            <Tarjeta numero={panel.notificaciones_no_leidas} titulo="Avisos sin leer" />
          </div>
          <Mensaje tipo="info">Conexión con el servidor correcta. El panel completo se construye en el paso 4.</Mensaje>
        </>
      )}
    </div>
  )
}

function Tarjeta({ numero, titulo }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-3xl font-bold text-slate-900">{String(numero).padStart(2, '0')}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{titulo}</p>
    </div>
  )
}
