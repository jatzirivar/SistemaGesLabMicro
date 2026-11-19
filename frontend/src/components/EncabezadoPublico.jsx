// Barra guinda de las pantallas sin sesión (login, registro, recuperar contraseña).
import { Link } from 'react-router-dom'
import logo from '../assets/logo-esime.png'

export default function EncabezadoPublico({ subtitulo }) {
  return (
    <header className="bg-guinda-800 text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/login" className="flex items-center gap-3">
          <img src={logo} alt="Logo ESIME" className="h-10 w-auto" />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-wide">ESIME CULHUACÁN</span>
            {subtitulo && <span className="block text-xs text-white/75">{subtitulo}</span>}
          </span>
        </Link>
      </div>
    </header>
  )
}
