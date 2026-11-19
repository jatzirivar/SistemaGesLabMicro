// Pantalla 2: Registro de estudiante (SRS 2).
// Pide nombre completo (en 3 campos, como se guarda en la BD), correo, boleta y contraseña.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/cliente'
import { Campo, CampoContrasena, ReglasContrasena, reglasContrasena } from '../components/Campos'
import Mensaje from '../components/Mensaje'
import TarjetaPublica from '../components/TarjetaPublica'

const VACIO = { nombre: '', apellido_pat: '', apellido_mat: '', correo: '', boleta: '', contrasena: '', confirmacion: '' }
const PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/
const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function validar(d, acepta) {
  const e = {}
  if (!d.nombre.trim()) e.nombre = 'El nombre es obligatorio'
  else if (!PATRON_NOMBRE.test(d.nombre.trim())) e.nombre = 'Solo letras y espacios'
  if (!d.apellido_pat.trim()) e.apellido_pat = 'El apellido paterno es obligatorio'
  else if (!PATRON_NOMBRE.test(d.apellido_pat.trim())) e.apellido_pat = 'Solo letras y espacios'
  if (d.apellido_mat.trim() && !PATRON_NOMBRE.test(d.apellido_mat.trim())) e.apellido_mat = 'Solo letras y espacios'
  if (!PATRON_CORREO.test(d.correo.trim())) e.correo = 'Escribe un correo válido'
  if (!/^\d{10}$/.test(d.boleta.trim())) e.boleta = 'La boleta debe tener exactamente 10 dígitos'
  if (!reglasContrasena(d.contrasena).every((r) => r.cumple)) e.contrasena = 'La contraseña no cumple los requisitos'
  if (d.confirmacion !== d.contrasena || !d.confirmacion) e.confirmacion = 'Las contraseñas no coinciden'
  if (!acepta) e.acepta = 'Debes aceptar para crear tu cuenta'
  return e
}

/** Relaciona los errores del servidor con el campo correspondiente. */
function erroresDelServidor(error) {
  const porCampo = {}
  for (const { campo, mensaje } of error.errores) if (campo && campo !== 'general') porCampo[campo] = mensaje
  if (error.estado === 409) {
    if (/boleta/i.test(error.message)) porCampo.boleta = error.message
    else if (/correo/i.test(error.message)) porCampo.correo = error.message
  }
  return porCampo
}

export default function Registro() {
  const navegar = useNavigate()
  const [datos, setDatos] = useState(VACIO)
  const [acepta, setAcepta] = useState(false)
  const [tocados, setTocados] = useState({})
  const [errorServidor, setErrorServidor] = useState(null)
  const [erroresServidor, setErroresServidor] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [creada, setCreada] = useState(null)

  const errores = validar(datos, acepta)
  const valido = Object.keys(errores).length === 0
  const errorDe = (campo) => erroresServidor[campo] || (tocados[campo] ? errores[campo] : undefined)

  const cambiar = (campo) => (e) => {
    setDatos((d) => ({ ...d, [campo]: e.target.value }))
    setErroresServidor((s) => ({ ...s, [campo]: undefined }))
  }
  const tocar = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }))

  const enviar = async (evento) => {
    evento.preventDefault()
    setTocados(Object.fromEntries(Object.keys({ ...VACIO, acepta: '' }).map((c) => [c, true])))
    if (!valido || enviando) return
    setEnviando(true)
    setErrorServidor(null)
    try {
      const estudiante = await api('/auth/registro', {
        metodo: 'POST',
        datos: {
          nombre: datos.nombre.trim(),
          apellido_pat: datos.apellido_pat.trim(),
          apellido_mat: datos.apellido_mat.trim() || null,
          correo: datos.correo.trim(),
          boleta: datos.boleta.trim(),
          contrasena: datos.contrasena,
        },
      })
      setCreada(estudiante)
    } catch (e) {
      setErroresServidor(erroresDelServidor(e))
      setErrorServidor(e)
    } finally {
      setEnviando(false)
    }
  }

  if (creada) {
    return (
      <TarjetaPublica antetitulo="Registro de gestión de materiales" titulo="¡Cuenta creada!">
        <Mensaje tipo="exito">
          {creada.nombre_completo}, tu cuenta quedó registrada con la boleta {creada.boleta}. Ya puedes iniciar sesión.
        </Mensaje>
        <button
          type="button"
          onClick={() => navegar('/login', { state: { usuario: creada.boleta } })}
          className="mt-5 w-full rounded-md bg-guinda-800 py-2.5 text-sm font-semibold text-white hover:bg-guinda-900"
        >
          Iniciar sesión →
        </button>
      </TarjetaPublica>
    )
  }

  return (
    <TarjetaPublica antetitulo="Registro de gestión de materiales" titulo="Crea tu cuenta">
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo id="nombre" etiqueta="Nombre(s)" placeholder="Ej. Paloma" autoComplete="given-name"
          value={datos.nombre} onChange={cambiar('nombre')} onBlur={tocar('nombre')} error={errorDe('nombre')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="apellido_pat" etiqueta="Apellido paterno" placeholder="Ej. Barrientos" autoComplete="family-name"
            value={datos.apellido_pat} onChange={cambiar('apellido_pat')} onBlur={tocar('apellido_pat')}
            error={errorDe('apellido_pat')} />
          <Campo id="apellido_mat" etiqueta="Apellido materno (opcional)" placeholder="Ej. Arellano"
            value={datos.apellido_mat} onChange={cambiar('apellido_mat')} onBlur={tocar('apellido_mat')}
            error={errorDe('apellido_mat')} />
        </div>
        <Campo id="correo" etiqueta="Correo electrónico" type="email" placeholder="usuario@alumno.ipn.mx" autoComplete="email"
          value={datos.correo} onChange={cambiar('correo')} onBlur={tocar('correo')} error={errorDe('correo')} />
        <Campo id="boleta" etiqueta="Boleta" inputMode="numeric" maxLength={10} placeholder="Ingresa tu número de boleta"
          value={datos.boleta} onChange={cambiar('boleta')} onBlur={tocar('boleta')} error={errorDe('boleta')} />
        <CampoContrasena id="contrasena" etiqueta="Contraseña" placeholder="Mínimo 8 caracteres" autoComplete="new-password"
          value={datos.contrasena} onChange={cambiar('contrasena')} onBlur={tocar('contrasena')}
          error={erroresServidor.contrasena} ayuda={<ReglasContrasena valor={datos.contrasena} />} />
        <CampoContrasena id="confirmacion" etiqueta="Confirmar contraseña" placeholder="Repite tu contraseña"
          autoComplete="new-password" value={datos.confirmacion} onChange={cambiar('confirmacion')}
          onBlur={tocar('confirmacion')} error={errorDe('confirmacion')} />

        <div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-guinda-800" />
            Acepto los Términos de uso y la Política de privacidad
          </label>
          {tocados.acepta && errores.acepta && <p className="mt-1 text-xs text-red-600">{errores.acepta}</p>}
        </div>

        {errorServidor && Object.keys(erroresServidor).length === 0 && (
          <Mensaje tipo="error" errores={errorServidor.errores}>{errorServidor.message}</Mensaje>
        )}

        <button type="submit" disabled={enviando}
          className="w-full rounded-md bg-guinda-800 py-2.5 text-sm font-semibold text-white transition hover:bg-guinda-900 disabled:opacity-60">
          {enviando ? 'Creando cuenta...' : 'Crear mi cuenta →'}
        </button>
        <p className="text-center text-sm text-slate-600">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" className="text-verde-700 underline">Inicia sesión</Link>
        </p>
      </form>
    </TarjetaPublica>
  )
}
