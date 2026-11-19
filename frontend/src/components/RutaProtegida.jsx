// Deja pasar solo a usuarios con sesión y con el rol indicado.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { rutaInicio, useAuth } from '../context/AuthContext'
import Cargando from './Cargando'

export default function RutaProtegida({ rol }) {
  const { usuario, cargando } = useAuth()
  const ubicacion = useLocation()

  if (cargando) return <Cargando texto="Cargando sesión..." pantallaCompleta />
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  // Un estudiante no entra al panel del encargado ni al revés
  if (rol && usuario.rol !== rol) return <Navigate to={rutaInicio(usuario)} replace />
  return <Outlet />
}
