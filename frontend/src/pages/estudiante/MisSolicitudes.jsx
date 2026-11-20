// Mis solicitudes (SRS 3.1 y 3.2): en curso, en revisión y finalizadas,
// con el historial de incidencias y sanciones en la pestaña "Historial".
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import Icono from '../../components/Icono'
import IncidenciasSanciones from '../../components/IncidenciasSanciones'
import Mensaje from '../../components/Mensaje'
import { boton, Encabezado, Tarjeta } from '../../components/Pagina'
import SolicitudesPorEstado from '../../components/SolicitudesPorEstado'

export default function MisSolicitudes() {
  const { state } = useLocation()
  const [pestana, setPestana] = useState(state?.pestana ?? 'activos')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    Promise.all([api('/solicitudes'), api('/estudiante/historial')])
      .then(([solicitudes, historial]) => activo && setDatos({ solicitudes, historial }))
      .catch((e) => activo && setError(e.message))
    return () => {
      activo = false
    }
  }, [])

  return (
    <div>
      <Encabezado
        antetitulo="Laboratorio de Microprocesadores"
        titulo="Mis solicitudes"
        descripcion="Consulta el estado de tus préstamos, tus solicitudes en revisión y tu historial."
        derecha={
          <Link to="/estudiante/catalogo" className={boton.primario}>
            <Icono nombre="mas" className="h-4 w-4" /> Nueva solicitud
          </Link>
        }
      />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!datos && !error && <Cargando texto="Cargando tus solicitudes..." />}
      {datos && (
        <Tarjeta className="!p-0 overflow-hidden">
          <SolicitudesPorEstado datos={datos.solicitudes} pestana={pestana} alCambiar={setPestana} />
          {pestana === 'historial' && <IncidenciasSanciones historial={datos.historial} />}
        </Tarjeta>
      )}
    </div>
  )
}
