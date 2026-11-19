// Mapa de pantallas del sistema.
import { Navigate, Route, Routes } from 'react-router-dom'
import Cargando from './components/Cargando'
import RutaProtegida from './components/RutaProtegida'
import { rutaInicio, useAuth } from './context/AuthContext'
import LayoutEncargado from './layouts/LayoutEncargado'
import LayoutEstudiante from './layouts/LayoutEstudiante'
import EnConstruccion from './pages/EnConstruccion'
import Login from './pages/Login'
import NoEncontrada from './pages/NoEncontrada'
import Recuperar from './pages/Recuperar'
import Registro from './pages/Registro'
import PanelEncargado from './pages/encargado/PanelEncargado'
import PanelEstudiante from './pages/estudiante/PanelEstudiante'

/** Login, registro y recuperación: si ya hay sesión, manda a su panel. */
function SoloSinSesion({ children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return <Cargando texto="Cargando sesión..." pantallaCompleta />
  return usuario ? <Navigate to={rutaInicio(usuario)} replace /> : children
}

function Inicio() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <Cargando texto="Cargando sesión..." pantallaCompleta />
  return <Navigate to={rutaInicio(usuario)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />

      {/* Pantallas 1 y 2 */}
      <Route path="/login" element={<SoloSinSesion><Login /></SoloSinSesion>} />
      <Route path="/registro" element={<SoloSinSesion><Registro /></SoloSinSesion>} />
      <Route path="/recuperar" element={<SoloSinSesion><Recuperar /></SoloSinSesion>} />

      {/* Estudiante: Pantallas 3 a 7 */}
      <Route element={<RutaProtegida rol="estudiante" />}>
        <Route path="/estudiante" element={<LayoutEstudiante />}>
          <Route index element={<Navigate to="panel" replace />} />
          <Route path="panel" element={<PanelEstudiante />} />
          <Route path="catalogo" element={<EnConstruccion titulo="Catálogo de equipos" paso={4} />} />
          <Route path="carrito" element={<EnConstruccion titulo="Carrito de solicitud" paso={4} />} />
          <Route path="solicitudes" element={<EnConstruccion titulo="Mis solicitudes" paso={4} />} />
          <Route path="solicitudes/:folio" element={<EnConstruccion titulo="Detalle de solicitud" paso={4} />} />
        </Route>
      </Route>

      {/* Encargado: Pantalla 8 y sus secciones */}
      <Route element={<RutaProtegida rol="encargado" />}>
        <Route path="/encargado" element={<LayoutEncargado />}>
          <Route index element={<Navigate to="panel" replace />} />
          <Route path="panel" element={<PanelEncargado />} />
          <Route path="solicitudes" element={<EnConstruccion titulo="Solicitudes y ventanilla" paso={5} />} />
          <Route path="inventario" element={<EnConstruccion titulo="Gestión de Inventario" paso={5} />} />
          <Route path="usuarios" element={<EnConstruccion titulo="Usuarios" paso={5} />} />
          <Route path="historial" element={<EnConstruccion titulo="Historial de préstamos" paso={5} />} />
          <Route path="configuracion" element={<EnConstruccion titulo="Configuración" paso={5} />} />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
