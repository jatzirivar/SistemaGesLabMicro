// Piezas comunes de las pantallas: migas de pan, encabezado, indicador de pasos y tarjeta.
import { Link } from 'react-router-dom'
import Icono from './Icono'

/** Inicio / Catálogo */
export function Migas({ items }) {
  return (
    <nav aria-label="Ruta" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, i) => (
        <span key={item.texto} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.a ? (
            <Link to={item.a} className="hover:text-guinda-800">
              {item.texto}
            </Link>
          ) : (
            <span className="font-medium text-slate-800">{item.texto}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/** Antetítulo verde, título grande y descripción. `derecha` va a la derecha en escritorio. */
export function Encabezado({ antetitulo, titulo, descripcion, derecha }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {antetitulo && <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-verde-700">{antetitulo}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{titulo}</h1>
        {descripcion && <p className="mt-2 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {derecha}
    </div>
  )
}

const PASOS = ['Selección', 'Revisión', 'Configurar']

/** Indicador de 3 pasos de la solicitud. `actual` = 1, 2 o 3. */
export function Pasos({ actual }) {
  return (
    <ol className="flex items-start" aria-label="Pasos de la solicitud">
      {PASOS.map((texto, i) => {
        const n = i + 1
        const hecho = n < actual
        const activo = n === actual
        return (
          <li key={texto} className="flex items-start">
            {i > 0 && <span className={`mt-3.5 h-px w-10 sm:w-16 ${hecho || activo ? 'bg-verde-600' : 'bg-slate-300'}`} />}
            <span className="flex w-20 flex-col items-center gap-1.5">
              <span
                aria-current={activo ? 'step' : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  hecho
                    ? 'bg-verde-700 text-white'
                    : activo
                      ? 'bg-guinda-800 text-white ring-4 ring-guinda-100'
                      : 'border border-slate-300 bg-white text-slate-400'
                }`}
              >
                {hecho ? <Icono nombre="check" className="h-4 w-4" /> : n}
              </span>
              <span className={`text-xs font-medium ${hecho ? 'text-verde-700' : activo ? 'text-guinda-800' : 'text-slate-400'}`}>
                {texto}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Tarjeta blanca con borde. */
export function Tarjeta({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>{children}</section>
}

/** Clases de botones para usar en <button> o <Link>. */
export const boton = {
  primario:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-guinda-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-guinda-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500',
  secundario:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-guinda-800/30 bg-white px-4 py-2.5 text-sm font-semibold text-guinda-800 transition hover:bg-guinda-50 disabled:cursor-not-allowed disabled:opacity-50',
  verde:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-verde-700 bg-white px-4 py-2 text-sm font-semibold text-verde-700 transition hover:bg-verde-50',
  peligro:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60',
}
