// Aviso de error, éxito o información. Muestra también la lista de motivos que manda el API.
const ESTILOS = {
  error: 'border-red-200 bg-red-50 text-red-800',
  exito: 'border-verde-600/30 bg-verde-50 text-verde-800',
  info: 'border-slate-200 bg-white text-slate-700',
  aviso: 'border-amber-200 bg-amber-50 text-amber-800',
}

export default function Mensaje({ tipo = 'info', children, errores = [] }) {
  if (!children && errores.length === 0) return null
  // Si el mensaje principal ya es el primer motivo, no se repite
  const extra = errores.map((e) => e.mensaje).filter((m) => m && m !== children)
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${ESTILOS[tipo]}`}>
      {children && <p>{children}</p>}
      {extra.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {extra.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
