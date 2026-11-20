// Consulta GET al API y guarda datos, error y estado de carga.
//   const { datos, error, cargando, recargar } = useApi('/encargado/panel')
//   const { datos } = useApi('/inventario/equipos', { pagina, buscar })
//   const { datos } = useApi('/encargado/panel', undefined, { cada: 5000 })  // se actualiza sola
// Con `cada` (milisegundos) vuelve a consultar en silencio cada ese tiempo y al regresar a la
// pestaña, para que los cambios de otros usuarios aparezcan sin recargar la página.
// Si `ruta` es null no consulta nada.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/cliente'

export default function useApi(ruta, parametros, { cada = 0 } = {}) {
  const llave = ruta ? `${ruta}?${JSON.stringify(parametros ?? {})}` : null
  const [estado, setEstado] = useState({ llave: null, datos: null, error: null })
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    if (!llave) return
    let activo = true
    const [r, p] = [llave.slice(0, llave.indexOf('?')), JSON.parse(llave.slice(llave.indexOf('?') + 1))]
    api(r, { parametros: p })
      .then((datos) => activo && setEstado({ llave, datos, error: null }))
      .catch((e) => activo && setEstado((s) => ({ llave, datos: s.llave === llave ? s.datos : null, error: e.message })))
    return () => {
      activo = false
    }
  }, [llave, vuelta])

  const recargar = useCallback(() => setVuelta((v) => v + 1), [])

  // Actualización automática: cada `cada` ms mientras la pestaña está visible, y al volver a ella
  useEffect(() => {
    if (!llave || !cada) return
    const id = setInterval(() => document.visibilityState === 'visible' && recargar(), cada)
    const alVolver = () => document.visibilityState === 'visible' && recargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [llave, cada, recargar])

  const vigente = estado.llave === llave
  return {
    datos: vigente ? estado.datos : null,
    error: vigente ? estado.error : null,
    cargando: Boolean(llave) && !vigente,
    recargar,
    // Conserva los datos anteriores mientras llega la siguiente página o filtro
    ultimo: estado.datos,
  }
}
