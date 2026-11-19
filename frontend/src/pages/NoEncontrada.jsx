import { Link } from 'react-router-dom'
import EncabezadoPublico from '../components/EncabezadoPublico'

export default function NoEncontrada() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EncabezadoPublico />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-5xl font-bold text-guinda-800">404</p>
        <p className="text-slate-600">La página que buscas no existe.</p>
        <Link to="/" className="text-sm text-verde-700 hover:underline">
          Ir al inicio
        </Link>
      </main>
    </div>
  )
}
