// Ventana modal sencilla: fondo oscuro, se cierra con Esc o con el botón ✕.
import { useEffect } from 'react'
import Icono from './Icono'

export default function Modal({ titulo, children, alCerrar, ancho = 'max-w-lg', sinCerrar = false }) {
  useEffect(() => {
    if (sinCerrar) return
    const alTecla = (e) => e.key === 'Escape' && alCerrar?.()
    document.addEventListener('keydown', alTecla)
    return () => document.removeEventListener('keydown', alTecla)
  }, [alCerrar, sinCerrar])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${ancho}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          {titulo && <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>}
          {!sinCerrar && (
            <button type="button" onClick={alCerrar} title="Cerrar" className="-m-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <Icono nombre="cerrar" className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
