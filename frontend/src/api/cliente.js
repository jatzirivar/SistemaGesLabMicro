// Cliente para hablar con el API de FastAPI.
// Todas las rutas empiezan con /api; Vite las reenvía al servidor (ver vite.config.js).

const LLAVE_TOKEN = 'sgpl_token'

export const sesion = {
  obtenerToken: () => localStorage.getItem(LLAVE_TOKEN),
  guardarToken: (token) => localStorage.setItem(LLAVE_TOKEN, token),
  borrarToken: () => localStorage.removeItem(LLAVE_TOKEN),
}

/** Error del API con el mensaje en español que manda el servidor. */
export class ErrorApi extends Error {
  constructor(mensaje, estado, errores = []) {
    super(mensaje)
    this.estado = estado // código HTTP (401, 409, 422...). 0 = sin conexión
    this.errores = errores // lista [{campo, mensaje}] cuando hay varios motivos
  }
}

/**
 * Hace una petición al API.
 *
 *   api('/auth/login', { metodo: 'POST', datos: { usuario, contrasena } })
 *   api('/catalogo', { parametros: { buscar: 'osc', pagina: 1 } })
 *   api('/inventario/equipos/OSC-001/foto', { metodo: 'PUT', formulario })
 *   api('/encargado/historial/pdf', { comoArchivo: true })   // devuelve un Blob
 */
export async function api(ruta, { metodo = 'GET', datos, formulario, parametros, comoArchivo = false } = {}) {
  let url = `/api${ruta}`
  if (parametros) {
    const limpios = Object.entries(parametros).filter(([, v]) => v !== undefined && v !== null && v !== '')
    if (limpios.length) url += `?${new URLSearchParams(limpios)}`
  }

  const headers = {}
  const token = sesion.obtenerToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let body
  if (formulario) {
    body = formulario // FormData: el navegador pone el Content-Type correcto
  } else if (datos !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(datos)
  }

  let respuesta
  try {
    respuesta = await fetch(url, { method: metodo, headers, body })
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor. Revisa que esté encendido.', 0)
  }

  // Sesión vencida o inválida: avisa a la aplicación para que regrese al login
  if (respuesta.status === 401 && token) {
    window.dispatchEvent(new Event('sesion-expirada'))
  }

  if (respuesta.ok && comoArchivo) return respuesta.blob()

  const esJson = respuesta.headers.get('content-type')?.includes('application/json')
  const cuerpo = esJson ? await respuesta.json() : null

  if (!respuesta.ok) {
    const mensaje = typeof cuerpo?.detail === 'string' ? cuerpo.detail : 'Ocurrió un error inesperado'
    throw new ErrorApi(mensaje, respuesta.status, cuerpo?.errores ?? [])
  }
  return cuerpo
}

/** Descarga un archivo (por ejemplo un PDF) que devuelve el API. */
export async function descargar(ruta, nombreArchivo, parametros) {
  const blob = await api(ruta, { parametros, comoArchivo: true })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}
