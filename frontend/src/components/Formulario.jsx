// Campos de formulario para las pantallas internas (encargado y estudiante).
export const claseCampo =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-guinda-700 focus:ring-2 focus:ring-guinda-100 disabled:bg-slate-50 disabled:text-slate-500'

/** Etiqueta + control + error/ayuda. `children` es el input, select o textarea. */
export function Etiquetado({ id, etiqueta, error, ayuda, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
    </div>
  )
}

export function Entrada({ id, etiqueta, error, ayuda, className, ...props }) {
  return (
    <Etiquetado id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className}>
      <input id={id} aria-invalid={Boolean(error)} className={`${claseCampo} ${error ? 'border-red-400' : ''}`} {...props} />
    </Etiquetado>
  )
}

export function Seleccion({ id, etiqueta, error, ayuda, className, children, ...props }) {
  return (
    <Etiquetado id={id} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className}>
      <select id={id} aria-invalid={Boolean(error)} className={claseCampo} {...props}>
        {children}
      </select>
    </Etiquetado>
  )
}

/** Área de texto con contador de caracteres. */
export function Texto({ id, etiqueta, error, ayuda, className, value = '', maxLength, rows = 3, ...props }) {
  return (
    <Etiquetado id={id} etiqueta={etiqueta} error={error} className={className}>
      <textarea id={id} rows={rows} value={value} maxLength={maxLength} aria-invalid={Boolean(error)} className={`${claseCampo} ${error ? 'border-red-400' : ''}`} {...props} />
      {!error && (
        <p className="mt-1 flex justify-between gap-2 text-xs text-slate-500">
          <span>{ayuda}</span>
          {maxLength && (
            <span>
              {value.length}/{maxLength}
            </span>
          )}
        </p>
      )}
    </Etiquetado>
  )
}

/** Busca el error de un campo en la lista [{campo, mensaje}] que manda el API. */
export function errorDe(error, campo) {
  return error?.errores?.find((e) => e.campo === campo)?.mensaje
}

/** Botones de pestañas. */
export function Pestanas({ opciones, actual, alCambiar }) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === actual}
          onClick={() => alCambiar(o.id)}
          className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${
            o.id === actual ? 'border-guinda-800 text-guinda-800' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.icono}
          {o.texto}
          {o.numero !== undefined && (
            <span className={`rounded-full px-2 text-xs ${o.id === actual ? 'bg-guinda-100 text-guinda-800' : 'bg-slate-100 text-slate-500'}`}>{o.numero}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/** Paginación sencilla. */
export function Paginacion({ pagina, totalPaginas, total, alCambiar }) {
  if (!totalPaginas || totalPaginas <= 1) return total !== undefined ? <p className="mt-4 text-xs text-slate-500">{total} en total</p> : null
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-xs text-slate-500">{total} en total</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">
          Anterior
        </button>
        <span className="text-slate-600">
          Página {pagina} de {totalPaginas}
        </span>
        <button type="button" disabled={pagina >= totalPaginas} onClick={() => alCambiar(pagina + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  )
}
