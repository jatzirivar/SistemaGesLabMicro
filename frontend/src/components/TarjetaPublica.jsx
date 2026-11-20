// Fondo gris con tarjeta blanca centrada, como en la maqueta del registro (Pantalla 2).
import EncabezadoPublico from './EncabezadoPublico'
import PiePagina from './PiePagina'

export default function TarjetaPublica({ antetitulo, titulo, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <EncabezadoPublico subtitulo="Préstamos de Equipos" />
      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="h-fit w-full max-w-md rounded-xl bg-white p-6 shadow-sm sm:p-8">
          {antetitulo && <p className="text-xs font-medium uppercase tracking-wide text-verde-700">{antetitulo}</p>}
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{titulo}</h1>
          <div className="mt-5">{children}</div>
        </div>
      </main>
      <PiePagina />
    </div>
  )
}
