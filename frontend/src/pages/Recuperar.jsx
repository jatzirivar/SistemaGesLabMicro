// Recuperación de contraseña (SRS 1.3), tal como la define el SRS:
// paso 1 se valida que el correo esté registrado; paso 2 se genera la nueva contraseña.
// También la usa el alumno registrado manualmente por el encargado para crear su contraseña.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/cliente'
import { Campo, CampoContrasena, ReglasContrasena, reglasContrasena } from '../components/Campos'
import Mensaje from '../components/Mensaje'
import TarjetaPublica from '../components/TarjetaPublica'

const PATRON_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export default function Recuperar() {
  const navegar = useNavigate()
  const [paso, setPaso] = useState(1) // 1 = correo, 2 = nueva contraseña, 3 = listo
  const [correo, setCorreo] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const correoValido = PATRON_CORREO.test(correo.trim())
  const nuevaValida = reglasContrasena(nueva).every((r) => r.cumple)
  const coinciden = confirmacion !== '' && confirmacion === nueva

  const ejecutar = async (accion) => {
    setError(null)
    setEnviando(true)
    try {
      await accion()
    } catch (e) {
      setError(e)
    } finally {
      setEnviando(false)
    }
  }

  const verificarCorreo = (evento) => {
    evento.preventDefault()
    if (!correoValido || enviando) return
    ejecutar(async () => {
      await api('/auth/restablecer/verificar', { metodo: 'POST', datos: { correo: correo.trim() } })
      setPaso(2)
    })
  }

  const guardar = (evento) => {
    evento.preventDefault()
    if (!nuevaValida || !coinciden || enviando) return
    ejecutar(async () => {
      await api('/auth/restablecer', {
        metodo: 'POST',
        datos: { correo: correo.trim(), contrasena_nueva: nueva, confirmacion },
      })
      setPaso(3)
    })
  }

  const boton =
    'w-full rounded-md bg-guinda-800 py-2.5 text-sm font-semibold text-white transition hover:bg-guinda-900 disabled:cursor-not-allowed disabled:opacity-60'

  if (paso === 3) {
    return (
      <TarjetaPublica antetitulo="Recuperar contraseña" titulo="Contraseña actualizada">
        <Mensaje tipo="exito">Tu nueva contraseña quedó guardada. Ya puedes iniciar sesión.</Mensaje>
        <button type="button" className={`${boton} mt-5`} onClick={() => navegar('/login', { replace: true })}>
          Iniciar sesión →
        </button>
      </TarjetaPublica>
    )
  }

  return (
    <TarjetaPublica antetitulo="Recuperar contraseña" titulo={paso === 1 ? 'Ingresa tu correo' : 'Crea tu nueva contraseña'}>
      {paso === 1 ? (
        <form onSubmit={verificarCorreo} className="space-y-4" noValidate>
          <p className="text-sm text-slate-600">Escribe el correo con el que te registraste.</p>
          <Campo id="correo" etiqueta="Correo electrónico" type="email" autoComplete="email" autoFocus
            placeholder="usuario@alumno.ipn.mx" value={correo} onChange={(e) => { setCorreo(e.target.value); setError(null) }} />
          {/* 404: "Correo no registrado" (SRS 1.3) */}
          {error && <Mensaje tipo="error" errores={error.errores}>{error.message}</Mensaje>}
          <button type="submit" disabled={!correoValido || enviando} className={boton}>
            {enviando ? 'Verificando...' : 'Continuar'}
          </button>
        </form>
      ) : (
        <form onSubmit={guardar} className="space-y-4" noValidate>
          <p className="text-sm text-slate-600">
            Correo verificado: <span className="font-medium text-slate-800">{correo.trim()}</span>
          </p>
          <CampoContrasena id="nueva" etiqueta="Nueva contraseña" autoComplete="new-password" autoFocus
            placeholder="Mínimo 8 caracteres" value={nueva} onChange={(e) => { setNueva(e.target.value); setError(null) }}
            ayuda={<ReglasContrasena valor={nueva} />} />
          <CampoContrasena id="confirmacion" etiqueta="Confirmar contraseña" autoComplete="new-password"
            placeholder="Repite tu contraseña" value={confirmacion} onChange={(e) => { setConfirmacion(e.target.value); setError(null) }}
            error={confirmacion && !coinciden ? 'Las contraseñas no coinciden' : undefined} />
          {/* Un encargado necesita mínimo 10 caracteres: el servidor lo indica aquí */}
          {error && <Mensaje tipo="error" errores={error.errores}>{error.message}</Mensaje>}
          <button type="submit" disabled={!nuevaValida || !coinciden || enviando} className={boton}>
            {enviando ? 'Guardando...' : 'Guardar contraseña'}
          </button>
          <button type="button" onClick={() => { setPaso(1); setError(null) }}
            className="w-full text-center text-sm text-verde-700 hover:underline">
            Usar otro correo
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link to="/login" className="text-verde-700 underline">Volver a iniciar sesión</Link>
      </p>
    </TarjetaPublica>
  )
}
