// Carrito temporal de préstamo (SRS 5). Vive en el navegador (localStorage) y es
// distinto para cada estudiante. Guarda piezas concretas (código de inventario).
// También carga las reglas vigentes del laboratorio (horario y límites).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/cliente'
import { useAuth } from './AuthContext'

const CarritoContext = createContext(null)

function leer(llave) {
  try {
    const datos = JSON.parse(localStorage.getItem(llave) ?? '[]')
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

export function CarritoProvider({ children }) {
  const { usuario } = useAuth()
  const llave = `sgpl_carrito_${usuario?.id ?? 'x'}`
  const [estado, setEstado] = useState(() => ({ llave, equipos: leer(llave) }))
  const [reglas, setReglas] = useState(null)

  // Si cambia de usuario, carga su propio carrito
  const equipos = estado.llave === llave ? estado.equipos : leer(llave)

  const guardar = useCallback(
    (cambio) =>
      setEstado((anterior) => {
        const actuales = anterior.llave === llave ? anterior.equipos : leer(llave)
        const nuevos = cambio(actuales)
        try {
          localStorage.setItem(llave, JSON.stringify(nuevos))
        } catch {
          // Sin espacio o modo privado: el carrito sigue funcionando en memoria
        }
        return { llave, equipos: nuevos }
      }),
    [llave],
  )

  useEffect(() => {
    let activo = true
    api('/solicitudes/reglas')
      .then((r) => activo && setReglas(r))
      .catch(() => activo && setReglas(null))
    return () => {
      activo = false
    }
  }, [])

  const limiteTotal = reglas?.limite_equipos ?? 5
  const limiteModelo = reglas?.limite_por_modelo ?? 2

  const cantidadModelo = useCallback((nombre) => equipos.filter((e) => e.nombre === nombre).length, [equipos])

  /** Devuelve el motivo por el que no se puede agregar, o null si sí se puede. */
  const motivoNoAgregar = useCallback(
    (equipo) => {
      if (equipos.some((e) => e.codigo_inventario === equipo.codigo_inventario)) return 'Ya está en tu carrito'
      if (cantidadModelo(equipo.nombre) >= limiteModelo) return `Máximo ${limiteModelo} de este equipo`
      if (equipos.length >= limiteTotal) return `Máximo ${limiteTotal} equipos por solicitud`
      return null
    },
    [equipos, cantidadModelo, limiteModelo, limiteTotal],
  )

  const valor = useMemo(
    () => ({
      equipos,
      total: equipos.length,
      reglas,
      limiteTotal,
      limiteModelo,
      cantidadModelo,
      motivoNoAgregar,
      tiene: (codigo) => equipos.some((e) => e.codigo_inventario === codigo),
      agregar: (equipo) => {
        if (motivoNoAgregar(equipo)) return
        const { codigo_inventario, nombre, categoria, foto_url } = equipo
        guardar((lista) => [...lista, { codigo_inventario, nombre, categoria, foto_url }])
      },
      quitar: (codigo) => guardar((lista) => lista.filter((e) => e.codigo_inventario !== codigo)),
      quitarModelo: (nombre) => guardar((lista) => lista.filter((e) => e.nombre !== nombre)),
      vaciar: () => guardar(() => []),
    }),
    [equipos, reglas, limiteTotal, limiteModelo, cantidadModelo, motivoNoAgregar, guardar],
  )

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>
}

export function useCarrito() {
  return useContext(CarritoContext)
}
