// Mapa de pantallas del sistema.
import { Navigate, Route, Routes } from 'react-router-dom'
import Cargando from './components/Cargando'
import RutaProtegida from './components/RutaProtegida'
import { rutaInicio, useAuth } from './context/AuthContext'
import LayoutEncargado from './layouts/LayoutEncargado'
import LayoutEstudiante from './layouts/LayoutEstudiante'
import Login from './pages/Login'
import NoEncontrada from './pages/NoEncontrada'
import Recuperar from './pages/Recuperar'
import Registro from './pages/Registro'
import Configuracion from './pages/encargado/Configuracion'
import FichaAlumno from './pages/encargado/FichaAlumno'
import Historial from './pages/encargado/Historial'
import Inventario from './pages/encargado/Inventario'
import PanelEncargado from './pages/encargado/PanelEncargado'
import Solicitudes from './pages/encargado/Solicitudes'
import Usuarios from './pages/encargado/Usuarios'
import Carrito from './pages/estudiante/Carrito'
import Catalogo from './pages/estudiante/Catalogo'
import ConfigurarSolicitud from './pages/estudiante/ConfigurarSolicitud'
import DetalleSolicitud from './pages/estudiante/DetalleSolicitud'
import MisSolicitudes from './pages/estudiante/MisSolicitudes'
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
          <Route path="catalogo" element={<Catalogo />} />
          <Route path="carrito" element={<Carrito />} />
          <Route path="carrito/configurar" element={<ConfigurarSolicitud />} />
          <Route path="solicitudes" element={<MisSolicitudes />} />
          <Route path="solicitudes/:folio" element={<DetalleSolicitud />} />
        </Route>
      </Route>

      {/* Encargado: Pantalla 8 y sus secciones */}
      <Route element={<RutaProtegida rol="encargado" />}>
        <Route path="/encargado" element={<LayoutEncargado />}>
          <Route index element={<Navigate to="panel" replace />} />
          <Route path="panel" element={<PanelEncargado />} />
          <Route path="solicitudes" element={<Solicitudes />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="usuarios/:id" element={<FichaAlumno />} />
          <Route path="historial" element={<Historial />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  )
}
