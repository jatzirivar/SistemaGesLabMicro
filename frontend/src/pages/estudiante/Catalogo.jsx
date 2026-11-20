// Pantalla 4: Catálogo de equipos (SRS 4, 4.1 y 5).
// Búsqueda por nombre o código, filtro por categoría y por disponibilidad.
// Solo "En mantenimiento" impide agregarlo. Un equipo prestado ahora se puede pedir para otro
// horario: se avisa con "Ocupado ahora, disponible en otros horarios".
import { useEffect, useState } from 'react'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import EtiquetaEstado from '../../components/EtiquetaEstado'
import FotoEquipo from '../../components/FotoEquipo'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Encabezado } from '../../components/Pagina'
import { useCarrito } from '../../context/CarritoContext'
import useCadaTanto from '../../hooks/useCadaTanto'

const POR_PAGINA = 12

/** Espera a que el usuario deje de escribir antes de buscar. */
function useRetrasado(valor, ms = 350) {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const id = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(id)
  }, [valor, ms])
  return v
}

export default function Catalogo() {
  const carrito = useCarrito()
  const [categorias, setCategorias] = useState([])
  const [texto, setTexto] = useState('')
  const [idCategoria, setIdCategoria] = useState('')
  const [disponibilidad, setDisponibilidad] = useState('')
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const vuelta = useCadaTanto(15_000) // disponibilidad al día cada 15 s
  const buscar = useRetrasado(texto.trim())

  useEffect(() => {
    api('/categorias').then(setCategorias).catch(() => setCategorias([]))
  }, [vuelta])

  useEffect(() => {
    let activo = true
    api('/catalogo', { parametros: { buscar, id_categoria: idCategoria, disponibilidad, pagina, por_pagina: POR_PAGINA } })
      .then((r) => {
        if (!activo) return
        setResultado(r)
        setError(null)
      })
      .catch((e) => activo && setError(e.message))
    return () => {
      activo = false
    }
  }, [buscar, idCategoria, disponibilidad, pagina, vuelta])

  // Al cambiar un filtro se regresa a la página 1
  const filtrar = (cambio) => {
    cambio()
    setPagina(1)
  }

  const disponibles = categorias.reduce((suma, c) => suma + c.disponibles, 0)

  return (
    <div>
      <Encabezado
        antetitulo="Laboratorio de Microprocesadores"
        titulo="Encuentra el equipo que necesitas"
        descripcion="Selecciona equipos disponibles y prepara tu solicitud de préstamo."
        derecha={
          categorias.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-verde-600/25 bg-verde-50 px-4 py-3 text-sm text-verde-800">
              <span className="rounded-full bg-verde-700 p-1.5 text-white">
                <Icono nombre="check" className="h-4 w-4" />
              </span>
              <span>
                <strong>
                  {disponibles} {disponibles === 1 ? 'equipo' : 'equipos'}
                </strong>{' '}
                disponibles ahora
              </span>
            </div>
          )
        }
      />

      {/* Búsqueda y filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Buscar equipo</span>
          <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={texto}
            onChange={(e) => filtrar(() => setTexto(e.target.value))}
            placeholder="Buscar por nombre o código de inventario"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-guinda-700 focus:ring-2 focus:ring-guinda-100"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Disponibilidad
          <select
            value={disponibilidad}
            onChange={(e) => filtrar(() => setDisponibilidad(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-guinda-700"
          >
            <option value="">Todos</option>
            <option value="Disponible">Disponible</option>
            <option value="En mantenimiento">En mantenimiento</option>
          </select>
        </label>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap gap-2">
          <Chip activo={idCategoria === ''} onClick={() => filtrar(() => setIdCategoria(''))}>
            Todos
          </Chip>
          {categorias.map((c) => (
            <Chip key={c.id_categoria} activo={idCategoria === c.id_categoria} onClick={() => filtrar(() => setIdCategoria(c.id_categoria))}>
              {c.nombre}
            </Chip>
          ))}
        </div>
        {resultado && (
          <span className="text-sm text-slate-500">
            {resultado.total} {resultado.total === 1 ? 'resultado' : 'resultados'}
          </span>
        )}
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!resultado && !error && <Cargando texto="Cargando catálogo..." />}

      {resultado && resultado.elementos.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
          No se encontraron equipos con esos filtros.
        </p>
      )}

      {resultado && resultado.elementos.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {resultado.elementos.map((eq) => (
            <TarjetaEquipo key={eq.codigo_inventario} equipo={eq} carrito={carrito} alVer={() => setDetalle(eq.codigo_inventario)} />
          ))}
        </div>
      )}

      {resultado && resultado.total_paginas > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <button type="button" className={boton.secundario} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <span className="text-slate-600">
            Página {resultado.pagina} de {resultado.total_paginas}
          </span>
          <button type="button" className={boton.secundario} disabled={pagina >= resultado.total_paginas} onClick={() => setPagina((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      )}

      {detalle && <DetalleEquipo codigo={detalle} carrito={carrito} alCerrar={() => setDetalle(null)} />}
    </div>
  )
}

function Chip({ activo, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        activo ? 'border-guinda-800 bg-guinda-800 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-guinda-700 hover:text-guinda-800'
      }`}
    >
      {children}
    </button>
  )
}

/** Botón de la tarjeta según el estado del equipo y del carrito (SRS 4.1). */
function BotonCarrito({ equipo, carrito }) {
  const enCarrito = carrito.tiene(equipo.codigo_inventario)
  const cantidad = carrito.cantidadModelo(equipo.nombre)
  const contador = `${cantidad}/${carrito.limiteModelo}`

  if (!equipo.se_puede_agregar) {
    return (
      <button type="button" disabled className="w-full cursor-not-allowed rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-400">
        En mantenimiento
      </button>
    )
  }
  if (enCarrito) {
    return (
      <button
        type="button"
        onClick={() => carrito.quitar(equipo.codigo_inventario)}
        title="Quitar del carrito"
        className="group flex w-full items-center justify-between rounded-lg border border-verde-600 bg-verde-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-verde-800"
      >
        <span className="flex items-center gap-2">
          <Icono nombre="check" className="h-4 w-4" />
          <span className="group-hover:hidden">En tu carrito</span>
          <span className="hidden group-hover:inline">Quitar</span>
        </span>
        <span className="text-xs">{contador}</span>
      </button>
    )
  }
  const motivo = carrito.motivoNoAgregar(equipo)
  if (motivo) {
    return (
      <button type="button" disabled className="w-full cursor-not-allowed rounded-lg bg-slate-100 px-3 py-2.5 text-xs font-medium text-slate-500">
        {motivo}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={() => carrito.agregar(equipo)}
      className="flex w-full items-center justify-between rounded-lg border border-verde-600/40 bg-verde-50 px-3 py-2.5 text-sm font-semibold text-verde-800 hover:bg-verde-600/15"
    >
      <span className="flex items-center gap-2">
        <Icono nombre="mas" className="h-4 w-4" />
        {cantidad > 0 ? 'Agregar otro' : 'Agregar al carrito'}
      </span>
      {cantidad > 0 && <span className="text-xs">{contador}</span>}
    </button>
  )
}

function OcupadoAhora() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-500/30">
      <Icono nombre="reloj" className="h-3 w-3" /> Ocupado ahora, disponible en otros horarios
    </span>
  )
}

function TarjetaEquipo({ equipo, carrito, alVer }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={alVer} className="relative block text-left" title="Ver detalle del equipo">
        <FotoEquipo url={equipo.foto_url} nombre={equipo.nombre} />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 shadow-sm">
          <EtiquetaEstado estado={equipo.disponibilidad} />
        </span>
      </button>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
          <span className="truncate text-verde-700">{equipo.categoria}</span>
          <span className="shrink-0 text-slate-500">{equipo.codigo_inventario}</span>
        </div>
        <button type="button" onClick={alVer} className="mt-2 text-left text-base font-semibold text-slate-900 hover:text-guinda-800">
          {equipo.nombre}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" onClick={alVer} className="text-xs text-slate-500 hover:underline">
            Ver detalle
          </button>
          {equipo.ocupado_ahora && <OcupadoAhora />}
        </div>
        <div className="mt-auto pt-4">
          <BotonCarrito equipo={equipo} carrito={carrito} />
        </div>
      </div>
    </article>
  )
}

/** Ficha del equipo: descripción, especificaciones, componentes y manual. */
function DetalleEquipo({ codigo, carrito, alCerrar }) {
  const [equipo, setEquipo] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api(`/catalogo/${encodeURIComponent(codigo)}`).then(setEquipo).catch((e) => setError(e.message))
  }, [codigo])

  const componentes = Array.isArray(equipo?.componentes_incluidos)
    ? equipo.componentes_incluidos
    : (equipo?.componentes_incluidos ?? '').split(/\n|,/).map((c) => c.trim()).filter(Boolean)

  return (
    <Modal titulo={equipo?.nombre ?? 'Detalle del equipo'} alCerrar={alCerrar} ancho="max-w-2xl">
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!equipo && !error && <Cargando texto="Cargando equipo..." />}
      {equipo && (
        <div className="space-y-4 text-sm text-slate-700">
          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <FotoEquipo url={equipo.foto_url} nombre={equipo.nombre} className="h-44 w-full rounded-xl" />
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <EtiquetaEstado estado={equipo.disponibilidad} />
                {equipo.ocupado_ahora && <OcupadoAhora />}
              </div>
              <p>
                <span className="text-slate-500">Código de inventario:</span> <strong>{equipo.codigo_inventario}</strong>
              </p>
              <p>
                <span className="text-slate-500">Categoría:</span> {equipo.categoria}
              </p>
              {equipo.descripcion && <p>{equipo.descripcion}</p>}
            </div>
          </div>
          {equipo.especificaciones && (
            <div>
              <h3 className="font-semibold text-slate-900">Especificaciones</h3>
              <p className="whitespace-pre-line">{equipo.especificaciones}</p>
            </div>
          )}
          {componentes.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900">Componentes incluidos</h3>
              <ul className="mt-1 list-disc pl-5">
                {componentes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            {equipo.manual_url ? (
              <a href={equipo.manual_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-guinda-800 hover:underline">
                <Icono nombre="documento" className="h-4 w-4" /> Ver manual (PDF)
              </a>
            ) : (
              <span />
            )}
            <div className="w-56">
              <BotonCarrito equipo={equipo} carrito={carrito} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
