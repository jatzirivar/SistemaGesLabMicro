// Foto del equipo; si no tiene, muestra un recuadro con ícono.
import { useState } from 'react'
import Icono from './Icono'

export default function FotoEquipo({ url, nombre, className = 'h-40 w-full' }) {
  const [fallo, setFallo] = useState(false)
  if (!url || fallo) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 ${className}`}>
        <Icono nombre="caja" className="h-10 w-10" />
      </div>
    )
  }
  return <img src={url} alt={nombre} loading="lazy" onError={() => setFallo(true)} className={`object-cover ${className}`} />
}
