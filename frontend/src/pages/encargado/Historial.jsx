// Historial de préstamos (SRS 8.15): filtros por fechas, estudiante, equipo y estado,
// y exportación a PDF con los mismos filtros.
import { useState } from 'react'
import { descargar } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import DetallePrestamo from '../../components/encargado/DetallePrestamo'
import EtiquetaEstado from '../../components/EtiquetaEstado'
import { Entrada, Paginacion, Seleccion } from '../../components/Formulario'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import { boton, Encabezado, Tarjeta } from '../../components/Pagina'
import useApi from '../../hooks/useApi'
import { fechaHoraCorta } from '../../utils/formato'

const VACIO = { desde: '', hasta: '', estudiante: '', codigo: '', estado: '' }
const ESTADOS = ['Aprobada', 'Entregada', 'Vencida', 'Devuelta', 'Cancelada', 'Rechazada']

export default function Historial() {
  const [borrador, setBorrador] = useState(VACIO)
  const [filtros, setFiltros] = useState(VACIO)
  const [pagina, setPagina] = useState(1)
  const [folio, setFolio] = useState(null)
  const [descargando, setDescargando] = useState(false)
  const [errorPdf, setErrorPdf] = useState(null)
  const limpios = Object.fromEntries(Object.entries(filtros).map(([k, v]) => [k, v.trim()]))
  const { datos, ultimo, error, cargando } = useApi('/encargado/historial', { ...limpios, pagina })
  const lista = datos ?? ultimo
  const cambiar = (c) => (e) => setBorrador((b) => ({ ...b, [c]: e.target.value }))
  const rangoInvalido = borrador.desde && borrador.hasta && borrador.desde > borrador.hasta

  const aplicar = (e) => {
    e.preventDefault()
    setFiltros(borrador)
    setPagina(1)
  }
  const exportar = async () => {
    setDescargando(true)
    setErrorPdf(null)
    try {
      await descargar('/encargado/historial/pdf', 'historial_prestamos.pdf', limpios)
    } catch (err) {
      setErrorPdf(err.message)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div>
      <Encabezado
        antetitulo="Laboratorio de Microprocesadores"
        titulo="Historial de préstamos"
        descripcion="Consulta todas las operaciones de préstamo del laboratorio."
        derecha={
          <button type="button" className={boton.secundario} onClick={exportar} disabled={descargando}>
            <Icono nombre="descargar" className="h-4 w-4" /> {descargando ? 'Generando...' : 'Exportar PDF'}
          </button>
        }
      />
      {errorPdf && (
        <div className="mb-4">
          <Mensaje tipo="error">{errorPdf}</Mensaje>
        </div>
      )}

      <Tarjeta className="mb-4 !p-4">
        <form onSubmit={aplicar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <Entrada id="h_desde" type="date" etiqueta="Retiro desde" value={borrador.desde} onChange={cambiar('desde')} />
          <Entrada id="h_hasta" type="date" etiqueta="Retiro hasta" value={borrador.hasta} onChange={cambiar('hasta')} error={rangoInvalido ? 'Debe ser posterior a "desde"' : null} />
          <Entrada id="h_est" etiqueta="Estudiante" placeholder="Boleta o nombre" value={borrador.estudiante} onChange={cambiar('estudiante')} />
          <Entrada id="h_cod" etiqueta="Equipo" placeholder="Código, ej. OSC-001" value={borrador.codigo} onChange={cambiar('codigo')} />
          <Seleccion id="h_estado" etiqueta="Estado" value={borrador.estado} onChange={cambiar('estado')}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Seleccion>
          <div className="flex gap-2">
            <button type="submit" className={`${boton.primario} flex-1`} disabled={rangoInvalido}>
              Filtrar
            </button>
            <button
              type="button"
              title="Quitar filtros"
              className={boton.secundario}
              onClick={() => {
                setBorrador(VACIO)
                setFiltros(VACIO)
                setPagina(1)
              }}
            >
              <Icono nombre="cerrar" className="h-4 w-4" />
            </button>
          </div>
        </form>
      </Tarjeta>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!lista && cargando && <Cargando texto="Cargando historial..." />}
      {lista && (
        <Tarjeta className="!p-0 overflow-hidden">
          {lista.elementos.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No hay préstamos con esos filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full min-w-[54rem] text-left text-sm ${cargando ? 'opacity-60' : ''}`}>
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Folio</th>
                    <th className="px-3 py-2.5">Estudiante</th>
                    <th className="px-3 py-2.5">Equipos</th>
                    <th className="px-3 py-2.5">Retiro programado</th>
                    <th className="px-3 py-2.5">Devuelto</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-4 py-2.5">Incidencias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.elementos.map((f) => (
                    <tr key={f.folio} className="cursor-pointer hover:bg-slate-50" onClick={() => setFolio(f.folio)}>
                      <td className="px-4 py-2.5 font-semibold text-verde-700">{f.folio}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-900">{f.estudiante}</p>
                        <p className="text-xs text-slate-500">{f.boleta}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{f.equipos.map((e) => e.codigo_inventario).join(', ')}</td>
                      <td className="px-3 py-2.5 text-xs">{fechaHoraCorta(f.fecha_hora_prog_retiro)}</td>
                      <td className="px-3 py-2.5 text-xs">{f.fecha_hora_real_devolucion ? fechaHoraCorta(f.fecha_hora_real_devolucion) : '—'}</td>
                      <td className="px-3 py-2.5">
                        <EtiquetaEstado estado={f.estado} />
                      </td>
                      <td className={`px-4 py-2.5 text-center ${f.incidencias ? 'font-semibold text-red-700' : 'text-slate-400'}`}>{f.incidencias}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 pb-4">
            <Paginacion pagina={lista.pagina} totalPaginas={lista.total_paginas} total={lista.total} alCambiar={setPagina} />
          </div>
        </Tarjeta>
      )}
      {folio && <DetallePrestamo folio={folio} alCerrar={() => setFolio(null)} />}
    </div>
  )
}
