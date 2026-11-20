// Formato de fechas y horas en la zona del laboratorio (Ciudad de México).
const ZONA = 'America/Mexico_City'

const fmtFecha = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtFechaLarga = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtFechaCorta = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
const fmtHora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })

/** Convierte "2026-11-20" (solo fecha) sin que el navegador la mueva un día por la zona horaria. */
function aFecha(valor) {
  if (valor instanceof Date) return valor
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T12:00:00-06:00`)
  return new Date(valor)
}

export const fecha = (v) => (v ? fmtFecha.format(aFecha(v)) : '—') // 20/11/2026
export const fechaCorta = (v) => (v ? fmtFechaCorta.format(aFecha(v)).replace('.', '') : '—') // 20 nov 2026
export const hora = (v) => (v ? fmtHora.format(aFecha(v)) : '—') // 14:30
export const fechaHora = (v) => (v ? `${fecha(v)} · ${hora(v)} h` : '—')
export const fechaHoraCorta = (v) => (v ? `${fechaCorta(v)} · ${hora(v)} h` : '—')

/** "miércoles, 18 de noviembre de 2026" con mayúscula inicial. */
export function hoyLargo() {
  const t = fmtFechaLarga.format(new Date())
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Fecha de hoy en la Ciudad de México como "AAAA-MM-DD" (para el campo de fecha). */
export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
}

/** Hora actual en la Ciudad de México como minutos desde las 00:00. */
export function minutosAhora() {
  const [h, m] = fmtHora.format(new Date()).split(':').map(Number)
  return h * 60 + m
}

/** "07:00:00" → minutos; y minutos → "07:00". */
export const aMinutos = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const deMinutos = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** 90 → "1 h 30 min" */
export function duracion(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ') || '0 min'
}

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** [1,2,3,4,5] → "lunes a viernes"; otros casos los lista. */
export function diasServicio(dias = []) {
  const orden = [...dias].sort()
  const seguidos = orden.every((d, i) => i === 0 || d === orden[i - 1] + 1)
  if (orden.length > 2 && seguidos) return `${DIAS[orden[0]]} a ${DIAS[orden.at(-1)]}`
  return orden.map((d) => DIAS[d]).join(', ')
}

/** Día de la semana ISO (1 = lunes ... 7 = domingo) de "AAAA-MM-DD". */
export function diaSemana(iso) {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

export const dosDigitos = (n) => String(n).padStart(2, '0')
