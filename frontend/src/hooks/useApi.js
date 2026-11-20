// Consulta GET al API y guarda datos, error y estado de carga.
//   const { datos, error, cargando, recargar } = useApi('/encargado/panel')
//   const { datos } = useApi('/inventario/equipos', { pagina, buscar })
// Si `ruta` es null no consulta nada.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/cliente'

export default function useApi(ruta, parametros) {
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
