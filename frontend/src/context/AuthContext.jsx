// Guarda quién inició sesión y ofrece iniciarSesion / cerrarSesion a toda la aplicación.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, sesion } from '../api/cliente'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null) // perfil de /api/auth/yo
  const [cargando, setCargando] = useState(true) // revisando si ya había una sesión guardada

  const cerrarSesion = useCallback(() => {
    sesion.borrarToken()
    setUsuario(null)
  }, [])

  // Al abrir la página: si hay token guardado, recupera el perfil
  useEffect(() => {
    if (!sesion.obtenerToken()) {
      setCargando(false)
      return
    }
    api('/auth/yo')
      .then(setUsuario)
      .catch(() => sesion.borrarToken())
      .finally(() => setCargando(false))
  }, [])

  // Si el servidor responde 401 en cualquier petición, se cierra la sesión
  useEffect(() => {
    window.addEventListener('sesion-expirada', cerrarSesion)
    return () => window.removeEventListener('sesion-expirada', cerrarSesion)
  }, [cerrarSesion])

  const iniciarSesion = useCallback(async (usuarioTexto, contrasena) => {
    const respuesta = await api('/auth/login', {
      metodo: 'POST',
      datos: { usuario: usuarioTexto, contrasena },
    })
    sesion.guardarToken(respuesta.access_token)
    const perfil = await api('/auth/yo')
    setUsuario(perfil)
    return respuesta // incluye ruta_inicio para redirigir (SRS 1.2)
  }, [])

  const recargarPerfil = useCallback(async () => {
    setUsuario(await api('/auth/yo'))
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion, recargarPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}

/** Página de inicio según el rol. */
export function rutaInicio(usuario) {
  if (!usuario) return '/login'
  return usuario.rol === 'encargado' ? '/encargado/panel' : '/estudiante/panel'
}
