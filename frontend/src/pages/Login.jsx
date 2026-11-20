// Pantalla 1: Inicio de sesión (SRS 1, 1.1 y 1.2).
// Estudiante: boleta + contraseña. Encargado: correo + contraseña.
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import EncabezadoPublico from '../components/EncabezadoPublico'
import Icono from '../components/Icono'
import Mensaje from '../components/Mensaje'
import PiePagina from '../components/PiePagina'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const [usuario, setUsuario] = useState(ubicacion.state?.usuario ?? '')
  const [contrasena, setContrasena] = useState('')
  const [verContrasena, setVerContrasena] = useState(false)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const completo = usuario.trim() !== '' && contrasena !== ''

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!completo || enviando) return
    setError(null)
    setEnviando(true)
    try {
      const respuesta = await iniciarSesion(usuario.trim(), contrasena)
      // Si venía de una página protegida de su mismo rol, regresa ahí; si no, a su panel
      const desde = ubicacion.state?.desde
      const destino = desde?.startsWith(`/${respuesta.rol}`) ? desde : respuesta.ruta_inicio
      navegar(destino, { replace: true })
    } catch (e) {
      // 401: "Usuario o contraseña incorrectos" · 423: cuenta bloqueada 15 min
      setError(e.message)
      setContrasena('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <EncabezadoPublico />

      {/* Fondo gris con recuadro blanco, igual que Crear cuenta y Recuperar contraseña */}
      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="h-fit w-full max-w-lg rounded-xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-center text-2xl font-semibold text-verde-700 sm:whitespace-nowrap sm:text-[1.65rem]">Laboratorio de Microprocesadores</h1>
          <h2 className="mt-6 text-lg font-medium text-slate-800">Iniciar Sesión</h2>

          <form onSubmit={enviar} className="mt-4 space-y-4" noValidate>
            <div>
              <label htmlFor="usuario" className="mb-1 block text-sm text-slate-700">
                Usuario
              </label>
              <input
                id="usuario"
                type="text"
                autoComplete="username"
                autoFocus
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Boleta o correo del encargado"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-guinda-700 focus:ring-2 focus:ring-guinda-100"
              />
            </div>

            <div>
              <label htmlFor="contrasena" className="mb-1 block text-sm text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="contrasena"
                  type={verContrasena ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full rounded-md border border-slate-300 px-3 py-2.5 pr-10 text-sm outline-none focus:border-guinda-700 focus:ring-2 focus:ring-guinda-100"
                />
                <button
                  type="button"
                  onClick={() => setVerContrasena((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  title={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icono nombre={verContrasena ? 'ojoTachado' : 'ojo'} className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error && <Mensaje tipo="error">{error}</Mensaje>}

            <button
              type="submit"
              disabled={!completo || enviando}
              className="w-full rounded-md bg-guinda-800 py-2.5 text-sm font-semibold text-white transition hover:bg-guinda-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm">
            <Link to="/recuperar" className="block text-verde-700 hover:underline">
              Recuperar contraseña
            </Link>
            <Link to="/registro" className="block text-verde-700 hover:underline">
              Registrar acceso
            </Link>
          </div>
        </div>
      </main>
      <PiePagina />
    </div>
  )
}
