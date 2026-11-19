// Estructura de las pantallas del encargado (Pantalla 8 y sus secciones).
// El mismo encabezado que el estudiante; las secciones están en el menú ☰.
import { Outlet } from 'react-router-dom'
import BarraSuperior from '../components/BarraSuperior'
import PiePagina from '../components/PiePagina'

// Menú acordado: las 4 opciones de la maqueta + Historial (SRS 8.15) y Configuración (SRS 8.14)
const menu = [
  { a: '/encargado/panel', texto: 'Panel operativo', icono: 'panel' },
  { a: '/encargado/solicitudes', texto: 'Solicitudes', icono: 'solicitudes' },
  { a: '/encargado/inventario', texto: 'Gestión de Inventario', icono: 'inventario' },
  { a: '/encargado/usuarios', texto: 'Usuarios', icono: 'usuarios' },
  { a: '/encargado/historial', texto: 'Historial', icono: 'historial' },
  { a: '/encargado/configuracion', texto: 'Configuración', icono: 'configuracion' },
]

export default function LayoutEncargado() {
  return (
    <div className="flex min-h-screen flex-col">
      <BarraSuperior inicio="/encargado/panel" menu={menu} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <PiePagina />
    </div>
  )
}
