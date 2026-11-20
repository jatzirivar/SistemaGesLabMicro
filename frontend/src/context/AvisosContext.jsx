// Avisos (notificaciones) del estudiante: SRS 3.3 y 3.4. Los comparten la campana
// del encabezado y la tarjeta "Avisos" del panel. Se actualizan cada minuto.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/cliente'

const AvisosContext = createContext(null)

export function AvisosProvider({ children }) {
  const [lista, setLista] = useState(null) // null = cargando
  const [error, setError] = useState(null)

  const recargar = useCallback(async () => {
    try {
      setLista(await api('/notificaciones'))
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    // La primera carga y la del intervalo llegan después, fuera del render
    const primera = setTimeout(recargar, 0)
    const id = setInterval(recargar, 10_000)
    return () => {
      clearTimeout(primera)
      clearInterval(id)
    }
  }, [recargar])

  const valor = useMemo(
    () => ({
      lista: lista ?? [],
      cargando: lista === null && !error,
      error,
      noLeidas: (lista ?? []).filter((n) => !n.leida).length,
      recargar,
      marcarLeida: async (id) => {
        setLista((l) => l?.map((n) => (n.id_notificacion === id ? { ...n, leida: true } : n)))
        try {
          await api(`/notificaciones/${id}/leida`, { metodo: 'PATCH' })
        } catch {
          recargar()
        }
      },
      marcarTodas: async () => {
        setLista((l) => l?.map((n) => ({ ...n, leida: true })))
        try {
          await api('/notificaciones/leer-todas', { metodo: 'POST' })
        } catch {
          recargar()
        }
      },
    }),
    [lista, error, recargar],
  )

  return <AvisosContext.Provider value={valor}>{children}</AvisosContext.Provider>
}

export function useAvisos() {
  return useContext(AvisosContext)
}
