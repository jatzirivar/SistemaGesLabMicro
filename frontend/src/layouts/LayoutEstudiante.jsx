// Estructura de las pantallas del estudiante (Pantallas 3 a 7).
import { Outlet } from 'react-router-dom'
import AccionesEstudiante from '../components/AccionesEstudiante'
import BarraSuperior from '../components/BarraSuperior'
import PiePagina from '../components/PiePagina'
import { AvisosProvider } from '../context/AvisosContext'
import { CarritoProvider } from '../context/CarritoContext'

const enlaces = [
  { a: '/estudiante/panel', texto: 'Inicio', icono: 'panel' },
  { a: '/estudiante/catalogo', texto: 'Catálogo', icono: 'catalogo' },
  { a: '/estudiante/solicitudes', texto: 'Mis solicitudes', icono: 'solicitudes' },
]

export default function LayoutEstudiante() {
  return (
    <CarritoProvider>
      <AvisosProvider>
        <div className="flex min-h-screen flex-col">
          <BarraSuperior inicio="/estudiante/panel" enlaces={enlaces} acciones={<AccionesEstudiante />} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            <Outlet />
          </main>
          <PiePagina />
        </div>
      </AvisosProvider>
    </CarritoProvider>
  )
}
