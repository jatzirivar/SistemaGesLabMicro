// Etiquetas de color de estado, iguales en todo el sistema (SRS 3.3):
//   Verde:    Disponible / Bueno / Aprobada / Entregada
//   Amarillo: Prestado / Pendiente / Próximo a vencer
//   Rojo:     En mantenimiento / Vencida / Dañado / Incompleto / Sancionado
// Los demás (Devuelta, Cancelada, Rechazada, No disponible) van en gris o rojo suave.
const VERDE = 'bg-verde-50 text-verde-700 ring-verde-600/25'
const AMARILLO = 'bg-amber-50 text-amber-800 ring-amber-500/30'
const ROJO = 'bg-red-50 text-red-700 ring-red-500/25'
const GRIS = 'bg-slate-100 text-slate-600 ring-slate-400/25'

const COLORES = {
  Disponible: VERDE,
  Bueno: VERDE,
  Aprobada: VERDE,
  Entregada: VERDE,
  Prestado: AMARILLO,
  Pendiente: AMARILLO,
  'Próximo a vencer': AMARILLO,
  'En mantenimiento': ROJO,
  Vencida: ROJO,
  Dañado: ROJO,
  Incompleto: ROJO,
  Sancionado: ROJO,
  Rechazada: ROJO,
  'No disponible': ROJO,
  Devuelta: GRIS,
  Cancelada: GRIS,
  // Cuentas y sanciones (pantallas del encargado)
  Activa: VERDE,
  Suspendida: ROJO,
  Bloqueada: AMARILLO,
  'Con adeudos': ROJO,
  Vigente: ROJO,
  Cumplida: GRIS,
  Condonada: GRIS,
  'Dado de baja': GRIS,
}

export function colorEstado(estado) {
  return COLORES[estado] ?? GRIS
}

export default function EtiquetaEstado({ estado, grande = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${colorEstado(estado)} ${
        grande ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {estado}
    </span>
  )
}
