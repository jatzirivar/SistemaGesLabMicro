// Devuelve un número que aumenta cada `ms` milisegundos (solo con la pestaña visible) y al
// regresar a la pestaña. Se agrega a las dependencias de un useEffect para que la consulta
// se repita sola y los cambios de otros usuarios aparezcan sin recargar la página.
import { useEffect, useState } from 'react'

export default function useCadaTanto(ms) {
  const [vuelta, setVuelta] = useState(0)
  useEffect(() => {
    const avanzar = () => document.visibilityState === 'visible' && setVuelta((v) => v + 1)
    const id = setInterval(avanzar, ms)
    document.addEventListener('visibilitychange', avanzar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', avanzar)
    }
  }, [ms])
  return vuelta
}
