// Página provisional para las pantallas que se construyen en los siguientes pasos.
import { Link } from 'react-router-dom'
import EncabezadoPublico from '../components/EncabezadoPublico'

export default function EnConstruccion({ titulo, paso, publica = false }) {
  const contenido = (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-500">Esta pantalla se construye en el paso {paso} del frontend.</p>
      {publica && (
        <Link to="/login" className="mt-4 inline-block text-sm text-verde-700 hover:underline">
          Volver a iniciar sesión
        </Link>
      )}
    </div>
  )

  if (!publica) return contenido
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <EncabezadoPublico />
      <main className="flex-1 px-4 py-10">{contenido}</main>
    </div>
  )
}
