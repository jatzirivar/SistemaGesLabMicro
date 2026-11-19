// Campos de formulario reutilizables con etiqueta, ayuda y mensaje de error.
import { useState } from 'react'
import Icono from './Icono'

const claseInput =
  'w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:border-guinda-700 focus:ring-2 focus:ring-guinda-100'

export function Campo({ id, etiqueta, error, ayuda, className = '', ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm text-slate-700">
        {etiqueta}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        className={`${claseInput} ${error ? 'border-red-400' : 'border-slate-300'}`}
        {...props}
      />
      {ayuda && !error && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function CampoContrasena({ id, etiqueta, error, ayuda, className = '', ...props }) {
  const [ver, setVer] = useState(false)
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm text-slate-700">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          className={`${claseInput} pr-10 ${error ? 'border-red-400' : 'border-slate-300'}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          title={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Icono nombre={ver ? 'ojoTachado' : 'ojo'} className="h-4 w-4" />
        </button>
      </div>
      {ayuda && !error && <div className="mt-1">{ayuda}</div>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Reglas del SRS 2 para la contraseña; se marcan en verde conforme se cumplen. */
export function reglasContrasena(valor, minimo = 8) {
  return [
    { texto: `Mínimo ${minimo} caracteres`, cumple: valor.length >= minimo },
    { texto: '1 mayúscula', cumple: /[A-ZÁÉÍÓÚÑ]/.test(valor) },
    { texto: '1 minúscula', cumple: /[a-záéíóúñ]/.test(valor) },
    { texto: '1 número', cumple: /\d/.test(valor) },
    { texto: 'Sin espacios', cumple: valor.length > 0 && !/\s/.test(valor) },
  ]
}

export function ReglasContrasena({ valor, minimo = 8 }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {reglasContrasena(valor, minimo).map((r) => (
        <li key={r.texto} className={r.cumple ? 'text-verde-700' : 'text-slate-500'}>
          {r.cumple ? '✓' : '•'} {r.texto}
        </li>
      ))}
    </ul>
  )
}
