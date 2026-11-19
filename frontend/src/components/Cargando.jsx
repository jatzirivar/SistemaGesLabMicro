export default function Cargando({ texto = 'Cargando...', pantallaCompleta = false }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-slate-500 ${pantallaCompleta ? 'min-h-screen' : 'py-12'}`}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-guinda-700" />
      <span className="text-sm">{texto}</span>
    </div>
  )
}
