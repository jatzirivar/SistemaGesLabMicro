// Dominios de correo permitidos (los mismos que revisa el servidor).
export const DOMINIOS_ALUMNO = ['gmail.com', 'alumno.ipn.mx'] // crear cuenta y registro manual
export const DOMINIOS_ENCARGADO = ['gmail.com', 'ipn.mx'] // alta de encargados
export const DOMINIOS_TODOS = ['gmail.com', 'ipn.mx', 'alumno.ipn.mx'] // recuperar contraseña (alumnos y encargados)

export const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

/** "@gmail.com o @alumno.ipn.mx" */
export function listaDominios(dominios) {
  const con = dominios.map((d) => `@${d}`)
  return con.length > 1 ? `${con.slice(0, -1).join(', ')} o ${con.at(-1)}` : con[0]
}

/** Mensaje de error del correo, o null si es válido y de un dominio permitido. */
export function errorCorreo(valor, dominios) {
  const correo = valor.trim().toLowerCase()
  if (!correo) return 'Escribe tu correo'
  if (!PATRON_CORREO.test(correo)) return 'Escribe un correo válido'
  if (!dominios.includes(correo.split('@').at(-1))) return `El correo debe terminar en ${listaDominios(dominios)}`
  return null
}
