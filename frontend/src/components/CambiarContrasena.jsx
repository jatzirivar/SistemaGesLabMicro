// SRS 1.4: cambio voluntario de contraseña desde el menú del usuario.
// Pide la contraseña actual, la nueva y su confirmación.
import { useState } from 'react'
import { api } from '../api/cliente'
import { useAuth } from '../context/AuthContext'
import { CampoContrasena, ReglasContrasena, reglasContrasena } from './Campos'
import Mensaje from './Mensaje'
import Modal from './Modal'
import { boton } from './Pagina'

export default function CambiarContrasena({ alCerrar }) {
  const { usuario } = useAuth()
  const minimo = usuario?.rol === 'encargado' ? 10 : 8
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [listo, setListo] = useState(false)

  const nuevaValida = reglasContrasena(nueva, minimo).every((r) => r.cumple)
  const coinciden = confirmacion !== '' && confirmacion === nueva
  const completo = actual !== '' && nuevaValida && coinciden

  const guardar = async (e) => {
    e.preventDefault()
    if (!completo || enviando) return
    setEnviando(true)
    setError(null)
    try {
      await api('/auth/contrasena', { metodo: 'PUT', datos: { contrasena_actual: actual, contrasena_nueva: nueva, confirmacion } })
      setListo(true)
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Cambiar contraseña" alCerrar={alCerrar}>
      {listo ? (
        <div className="space-y-4">
          <Mensaje tipo="exito">Tu contraseña se actualizó. Úsala la próxima vez que inicies sesión.</Mensaje>
          <div className="flex justify-end">
            <button type="button" className={boton.primario} onClick={alCerrar}>
              Listo
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={guardar} className="space-y-4" noValidate>
          <CampoContrasena id="contrasena_actual" etiqueta="Contraseña actual" autoComplete="current-password" autoFocus value={actual}
            onChange={(e) => { setActual(e.target.value); setError(null) }} />
          <CampoContrasena id="contrasena_nueva" etiqueta="Nueva contraseña" autoComplete="new-password" value={nueva}
            onChange={(e) => { setNueva(e.target.value); setError(null) }} ayuda={<ReglasContrasena valor={nueva} minimo={minimo} />} />
          <CampoContrasena id="contrasena_confirmacion" etiqueta="Confirmar nueva contraseña" autoComplete="new-password" value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)} error={confirmacion && !coinciden ? 'Las contraseñas no coinciden' : null} />
          {error && (
            <Mensaje tipo="error" errores={error.errores}>
              {error.message}
            </Mensaje>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" className={boton.secundario} onClick={alCerrar}>
              Cancelar
            </button>
            <button type="submit" className={boton.primario} disabled={!completo || enviando}>
              {enviando ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
