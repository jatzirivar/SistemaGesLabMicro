// Encabezado guinda común a todas las pantallas con sesión (estudiante y encargado):
// [☰] Logo · ESIME CULHUACÁN · Préstamos de equipos ........ [enlaces] [Nombre ▾]
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import logo from '../assets/logo-esime.png'
import { useAuth } from '../context/AuthContext'
import Icono from './Icono'

/** Cierra un menú desplegable al dar clic fuera de él o al presionar Esc. */
export function useCerrarAlSalir(abierto, cerrar) {
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const alClic = (e) => ref.current && !ref.current.contains(e.target) && cerrar()
    const alTecla = (e) => e.key === 'Escape' && cerrar()
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto, cerrar])
  return ref
}

/**
 * inicio:  ruta a la que lleva el logo
 * enlaces: opciones visibles en la barra (estudiante). En celular pasan al menú ☰.
 * menu:    opciones del menú ☰ (encargado). Si hay menú, el botón ☰ se ve siempre.
 * acciones: botones extra a la derecha del nombre (estudiante: avisos y carrito).
 */
export default function BarraSuperior({ inicio, enlaces = [], menu = [], acciones = null }) {
  const { usuario, cerrarSesion } = useAuth()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [usuarioAbierto, setUsuarioAbierto] = useState(false)
  useCerrarAlSalir(menuAbierto, () => setMenuAbierto(false)) // Esc cierra el menú
  const refUsuario = useCerrarAlSalir(usuarioAbierto, () => setUsuarioAbierto(false))

  const opcionesMenu = menu.length ? menu : enlaces
  const salir = () => {
    cerrarSesion()
    navegar('/login', { replace: true })
  }

  return (
    <header className="relative z-30 bg-guinda-800 text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        {/* Botón ☰: siempre para el encargado; en celular también para el estudiante */}
        <button
          type="button"
          title="Menú"
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((v) => !v)}
          className={`rounded-md p-2 hover:bg-white/10 ${menu.length ? '' : 'sm:hidden'}`}
        >
          <Icono nombre="menu" className="h-6 w-6" />
        </button>

        {/* Panel lateral que se despliega con ☰, debajo de la barra guinda, con botones grandes */}
        {menuAbierto && (
          <div className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/30" onClick={() => setMenuAbierto(false)} aria-hidden="true" />
        )}
        <aside
          aria-label="Menú"
          inert={!menuAbierto}
          className={`fixed bottom-0 left-0 top-16 z-50 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white p-4 text-slate-800 shadow-xl transition-all duration-200 ${
            menuAbierto ? 'visible translate-x-0' : 'invisible -translate-x-full'
          }`}
        >
          <nav className="space-y-2">
            {opcionesMenu.map((m) => (
              <NavLink
                key={m.a}
                to={m.a}
                onClick={() => setMenuAbierto(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'border-guinda-800 bg-guinda-800 text-white'
                      : 'border-slate-200 text-guinda-800 hover:bg-guinda-50'
                  }`
                }
              >
                {m.icono && <Icono nombre={m.icono} className="h-5 w-5" />}
                {m.texto}
              </NavLink>
            ))}
          </nav>
        </aside>

        <Link to={inicio} className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="Logo ESIME" className="h-9 w-auto shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold tracking-wide">ESIME CULHUACÁN</span>
            <span className="block truncate text-xs text-white/75">Préstamos de equipos</span>
          </span>
        </Link>

        {enlaces.length > 0 && (
          <nav className="ml-8 hidden h-16 items-center gap-1 sm:flex">
            {enlaces.map((e) => (
              <NavLink
                key={e.a}
                to={e.a}
                className={({ isActive }) =>
                  `flex h-full items-center border-b-2 px-3 text-sm font-medium transition ${
                    isActive ? 'border-white text-white' : 'border-transparent text-white/75 hover:text-white'
                  }`
                }
              >
                {e.texto}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Nombre del usuario: al presionarlo muestra el nombre completo, boleta o correo, y Cerrar sesión */}
        <div className="ml-auto flex items-center gap-2">
          <div ref={refUsuario} className="relative">
            <button
              type="button"
              aria-expanded={usuarioAbierto}
              onClick={() => setUsuarioAbierto((v) => !v)}
              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
            >
              <Icono nombre="usuario" className="h-4 w-4" />
              <span className="hidden sm:inline">
                {usuario?.nombre} {usuario?.apellido_pat?.[0]}.
              </span>
            </button>
            {usuarioAbierto && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-lg">
                <div className="border-b border-slate-100 px-4 py-2">
                  <p className="font-medium text-slate-800">{usuario?.nombre_completo}</p>
                  <p className="text-xs text-slate-500">
                    {usuario?.rol === 'estudiante' ? `Boleta ${usuario?.boleta}` : usuario?.correo}
                  </p>
                </div>
                <button type="button" onClick={salir} className="flex w-full items-center gap-2 px-4 py-2 hover:bg-slate-50">
                  <Icono nombre="salir" className="h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
          {acciones}
        </div>
      </div>
    </header>
  )
}
