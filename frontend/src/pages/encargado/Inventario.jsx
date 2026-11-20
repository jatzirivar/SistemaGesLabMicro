// Gestión de Inventario (SRS 8.8, 8.10, 8.11 y 8.12).
//   Equipos: tabla de 20 por página con código, nombre, foto, manual, categoría, estado y
//            fecha de adquisición; alta, edición, foto, manual, estado, baja y eliminación.
//   Categorías: crear, renombrar y eliminar (bloqueado si tiene equipos asignados).
import { useState } from 'react'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import EtiquetaEstado from '../../components/EtiquetaEstado'
import FotoEquipo from '../../components/FotoEquipo'
import { claseCampo, Entrada, errorDe, Paginacion, Pestanas, Seleccion, Texto } from '../../components/Formulario'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Encabezado, Tarjeta } from '../../components/Pagina'
import useApi from '../../hooks/useApi'
import { fecha, hoyISO } from '../../utils/formato'

export default function Inventario() {
  const [pestana, setPestana] = useState('equipos')
  return (
    <div>
      <Encabezado antetitulo="Laboratorio de Microprocesadores" titulo="Gestión de Inventario" descripcion="Administra los equipos del laboratorio y sus categorías." />
      <Pestanas
        opciones={[
          { id: 'equipos', texto: 'Equipos', icono: <Icono nombre="inventario" className="h-4 w-4" /> },
          { id: 'categorias', texto: 'Categorías', icono: <Icono nombre="catalogo" className="h-4 w-4" /> },
        ]}
        actual={pestana}
        alCambiar={setPestana}
      />
      {pestana === 'equipos' ? <Equipos /> : <Categorias />}
    </div>
  )
}

// ====================================================================== EQUIPOS

function Equipos() {
  const [buscar, setBuscar] = useState('')
  const [idCategoria, setIdCategoria] = useState('')
  const [estado, setEstado] = useState('')
  const [pagina, setPagina] = useState(1)
  const [modal, setModal] = useState(null) // { tipo, equipo }
  const [aviso, setAviso] = useState(null)
  const { datos: categorias, recargar: recargarCategorias } = useApi('/categorias')
  const { datos, ultimo, error, cargando, recargar } = useApi('/inventario/equipos', { buscar: buscar.trim(), id_categoria: idCategoria, id_estado_equipo: estado, pagina })
  const lista = datos ?? ultimo

  const filtrar = (cambio) => {
    cambio()
    setPagina(1)
  }
  const terminar = (texto) => {
    setModal(null)
    setAviso(texto)
    recargar()
    recargarCategorias()
  }

  return (
    <div className="space-y-4">
      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      <Tarjeta className="!p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Buscar</span>
            <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={buscar} onChange={(e) => filtrar(() => setBuscar(e.target.value))} placeholder="Buscar por nombre o código" className={`${claseCampo} pl-9`} />
          </label>
          <select aria-label="Categoría" value={idCategoria} onChange={(e) => filtrar(() => setIdCategoria(e.target.value))} className={claseCampo.replace('w-full', 'w-auto')}>
            <option value="">Todas las categorías</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select aria-label="Estado" value={estado} onChange={(e) => filtrar(() => setEstado(e.target.value))} className={claseCampo.replace('w-full', 'w-auto')}>
            <option value="">Todos los estados</option>
            <option value="1">Disponible</option>
            <option value="2">Prestado</option>
            <option value="3">En mantenimiento</option>
            <option value="4">Dado de baja</option>
          </select>
          <button type="button" className={boton.primario} onClick={() => setModal({ tipo: 'nuevo' })}>
            <Icono nombre="mas" className="h-4 w-4" /> Nuevo equipo
          </button>
        </div>
      </Tarjeta>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!lista && cargando && <Cargando texto="Cargando inventario..." />}
      {lista && (
        <Tarjeta className="!p-0 overflow-hidden">
          {lista.elementos.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No hay equipos con esos filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full min-w-[56rem] text-left text-sm ${cargando ? 'opacity-60' : ''}`}>
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Foto</th>
                    <th className="px-3 py-2.5">Código</th>
                    <th className="px-3 py-2.5">Nombre</th>
                    <th className="px-3 py-2.5">Categoría</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5">Adquisición</th>
                    <th className="px-3 py-2.5">Manual</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.elementos.map((e) => (
                    <tr key={e.codigo_inventario}>
                      <td className="px-4 py-2">
                        <FotoEquipo url={e.foto_url} nombre={e.nombre} className="h-10 w-12 rounded-md" />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-700">{e.codigo_inventario}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{e.nombre}</td>
                      <td className="px-3 py-2 text-slate-600">{e.categoria}</td>
                      <td className="px-3 py-2">
                        <EtiquetaEstado estado={e.estado} />
                      </td>
                      <td className="px-3 py-2 text-slate-600">{fecha(e.fecha_adquisicion)}</td>
                      <td className="px-3 py-2">
                        {e.manual_url ? (
                          <a href={e.manual_url} target="_blank" rel="noreferrer" className="text-xs font-medium text-guinda-800 hover:underline">
                            Ver PDF
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end">
                          <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setModal({ tipo: 'acciones', equipo: e })}>
                            Gestionar
                          </button>
                        </div>
                      </td>
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

      {modal?.tipo === 'nuevo' && <FormularioEquipo categorias={categorias ?? []} alCerrar={() => setModal(null)} alTerminar={terminar} />}
      {modal?.tipo === 'acciones' && <AccionesEquipo equipo={modal.equipo} alCerrar={() => setModal(null)} alTerminar={terminar} />}
    </div>
  )
}

/** Alta (con categoría) o edición (sin cambiar código ni categoría: SRS 8.10). */
function FormularioEquipo({ equipo, categorias, alCerrar, alTerminar }) {
  const editar = Boolean(equipo)
  const [d, setD] = useState({
    nombre: equipo?.nombre ?? '',
    id_categoria: equipo?.id_categoria ?? '',
    fecha_adquisicion: equipo?.fecha_adquisicion ?? '',
    descripcion: equipo?.descripcion ?? '',
    especificaciones: equipo?.especificaciones ?? '',
    componentes_incluidos: equipo?.componentes_incluidos ?? '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const cambiar = (campo) => (e) => setD((x) => ({ ...x, [campo]: e.target.value }))
  const completo = d.nombre.trim() && (editar || d.id_categoria) && d.fecha_adquisicion && d.descripcion.trim() && d.especificaciones.trim() && d.componentes_incluidos.trim()

  const guardar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const { id_categoria, ...campos } = d
    try {
      const r = editar
        ? await api(`/inventario/equipos/${encodeURIComponent(equipo.codigo_inventario)}`, { metodo: 'PUT', datos: campos })
        : await api('/inventario/equipos', { metodo: 'POST', datos: { ...campos, id_categoria: Number(id_categoria) } })
      alTerminar(editar ? `Se guardaron los cambios de ${r.codigo_inventario}.` : `Equipo dado de alta con el código ${r.codigo_inventario}. Ahora puedes subir su foto y su manual desde "Gestionar".`)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={editar ? `Editar ${equipo.codigo_inventario}` : 'Nuevo equipo'} alCerrar={alCerrar} ancho="max-w-2xl">
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Entrada id="eq_nombre" etiqueta="Nombre" value={d.nombre} maxLength={100} onChange={cambiar('nombre')} error={errorDe(error, 'nombre')} className="sm:col-span-2" />
          {editar ? (
            <Entrada id="eq_cat" etiqueta="Categoría" value={equipo.categoria} disabled ayuda="El código y la categoría no se pueden cambiar" />
          ) : (
            <Seleccion id="eq_cat" etiqueta="Categoría" value={d.id_categoria} onChange={cambiar('id_categoria')} ayuda="El código se genera solo con el prefijo de la categoría">
              <option value="">Selecciona...</option>
              {categorias.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nombre} ({c.prefijo})
                </option>
              ))}
            </Seleccion>
          )}
          <Entrada id="eq_fecha" type="date" max={hoyISO()} etiqueta="Fecha de adquisición" value={d.fecha_adquisicion} onChange={cambiar('fecha_adquisicion')} error={errorDe(error, 'fecha_adquisicion')} />
        </div>
        <Texto id="eq_desc" etiqueta="Descripción" value={d.descripcion} maxLength={2000} onChange={cambiar('descripcion')} />
        <Texto id="eq_esp" etiqueta="Especificaciones" value={d.especificaciones} maxLength={2000} onChange={cambiar('especificaciones')} />
        <Texto
          id="eq_comp"
          etiqueta="Componentes incluidos"
          value={d.componentes_incluidos}
          maxLength={2000}
          ayuda="Uno por renglón o separados por comas. Se usan como checklist en la entrega."
          onChange={cambiar('componentes_incluidos')}
        />
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
            {enviando ? 'Guardando...' : editar ? 'Guardar cambios' : 'Dar de alta'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Menú de acciones de un equipo. */
function AccionesEquipo({ equipo, alCerrar, alTerminar }) {
  const [vista, setVista] = useState('menu')
  const [motivo, setMotivo] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const ruta = `/inventario/equipos/${encodeURIComponent(equipo.codigo_inventario)}`
  const dadoDeBaja = equipo.id_estado_equipo === 4

  const ejecutar = async (accion, texto) => {
    setEnviando(true)
    setError(null)
    try {
      await accion()
      alTerminar(texto)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }
  const subir = (tipo) => {
    const formulario = new FormData()
    formulario.append('archivo', archivo)
    return ejecutar(() => api(`${ruta}/${tipo}`, { metodo: 'PUT', formulario }), tipo === 'foto' ? 'Foto actualizada.' : 'Manual actualizado.')
  }

  if (vista === 'editar') return <FormularioEquipo equipo={equipo} alCerrar={alCerrar} alTerminar={alTerminar} />

  const errorCaja = error && (
    <div className="mt-3">
      <Mensaje tipo="error" errores={error.errores}>
        {error.message}
      </Mensaje>
    </div>
  )

  return (
    <Modal titulo={`${equipo.codigo_inventario} · ${equipo.nombre}`} alCerrar={alCerrar}>
      {vista === 'menu' && (
        <div className="space-y-2">
          <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
            Estado actual: <EtiquetaEstado estado={equipo.estado} />
          </p>
          {dadoDeBaja && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              Dado de baja el {fecha(equipo.fecha_baja)}: {equipo.motivo_baja}
            </p>
          )}
          {!dadoDeBaja && (
            <>
              <Opcion icono="lapiz" texto="Editar datos" onClick={() => setVista('editar')} />
              <Opcion icono="subir" texto="Subir foto (JPG, PNG o WebP, máx. 5 MB)" onClick={() => setVista('foto')} />
              <Opcion icono="documento" texto="Subir manual (PDF, máx. 10 MB)" onClick={() => setVista('manual')} />
              {equipo.estado === 'Disponible' && (
                <Opcion icono="configuracion" texto="Enviar a mantenimiento" onClick={() => ejecutar(() => api(`${ruta}/estado`, { metodo: 'PATCH', datos: { estado: 'En mantenimiento' } }), `${equipo.codigo_inventario} quedó En mantenimiento.`)} />
              )}
              {equipo.estado === 'En mantenimiento' && (
                <Opcion icono="check" texto="Marcar como Disponible" onClick={() => ejecutar(() => api(`${ruta}/estado`, { metodo: 'PATCH', datos: { estado: 'Disponible' } }), `${equipo.codigo_inventario} quedó Disponible.`)} />
              )}
              <Opcion icono="alerta" texto="Dar de baja" peligro onClick={() => setVista('baja')} />
            </>
          )}
          <Opcion icono="basura" texto="Eliminar del inventario" peligro onClick={() => setVista('eliminar')} />
          {errorCaja}
        </div>
      )}

      {(vista === 'foto' || vista === 'manual') && (
        <div>
          <input
            type="file"
            aria-label={vista === 'foto' ? 'Foto' : 'Manual'}
            accept={vista === 'foto' ? 'image/jpeg,image/png,image/webp' : 'application/pdf'}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-guinda-50 file:px-3 file:py-2 file:font-semibold file:text-guinda-800"
          />
          {errorCaja}
          <Botones alVolver={() => setVista('menu')} texto="Subir" deshabilitado={!archivo || enviando} onClick={() => subir(vista)} />
        </div>
      )}

      {vista === 'baja' && (
        <div>
          <p className="mb-3 text-sm text-slate-600">La baja conserva el historial del equipo y su código no se vuelve a usar. No se permite si está en un préstamo Aprobada, Entregada o Vencida.</p>
          <Texto id="motivo_baja" etiqueta="Motivo de baja" value={motivo} maxLength={255} ayuda="Mínimo 5 caracteres" onChange={(e) => setMotivo(e.target.value)} />
          {errorCaja}
          <Botones
            alVolver={() => setVista('menu')}
            texto="Dar de baja"
            peligro
            deshabilitado={motivo.trim().length < 5 || enviando}
            onClick={() => ejecutar(() => api(`${ruta}/baja`, { metodo: 'POST', datos: { motivo: motivo.trim() } }), `${equipo.codigo_inventario} se dio de baja.`)}
          />
        </div>
      )}

      {vista === 'eliminar' && (
        <div>
          <p className="text-sm text-slate-600">¿Eliminar {equipo.codigo_inventario} definitivamente? Solo se permite si nunca ha estado en un préstamo; si ya tiene historial, usa "Dar de baja".</p>
          {errorCaja}
          <Botones alVolver={() => setVista('menu')} texto="Eliminar" peligro deshabilitado={enviando} onClick={() => ejecutar(() => api(ruta, { metodo: 'DELETE' }), `${equipo.codigo_inventario} se eliminó.`)} />
        </div>
      )}
    </Modal>
  )
}

function Opcion({ icono, texto, onClick, peligro }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium ${peligro ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-slate-200 text-slate-800 hover:bg-slate-50'}`}
    >
      <Icono nombre={icono} className="h-4 w-4" /> {texto}
    </button>
  )
}

function Botones({ alVolver, texto, onClick, deshabilitado, peligro }) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <button type="button" className={boton.secundario} onClick={alVolver}>
        Volver
      </button>
      <button type="button" className={peligro ? boton.peligro : boton.primario} disabled={deshabilitado} onClick={onClick}>
        {texto}
      </button>
    </div>
  )
}

// ====================================================================== CATEGORÍAS

function Categorias() {
  const { datos, error, recargar } = useApi('/categorias')
  const [modal, setModal] = useState(null) // { categoria? , eliminar? }
  const [aviso, setAviso] = useState(null)

  const terminar = (texto) => {
    setModal(null)
    setAviso(texto)
    recargar()
  }

  return (
    <div className="space-y-4">
      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      <div className="flex justify-end">
        <button type="button" className={boton.primario} onClick={() => setModal({})}>
          <Icono nombre="mas" className="h-4 w-4" /> Nueva categoría
        </button>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!datos && !error && <Cargando texto="Cargando categorías..." />}
      {datos && (
        <Tarjeta className="!p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Categoría</th>
                <th className="px-3 py-2.5">Prefijo</th>
                <th className="px-3 py-2.5">Equipos</th>
                <th className="px-3 py-2.5">Disponibles</th>
                <th className="px-4 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datos.map((c) => (
                <tr key={c.id_categoria}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{c.nombre}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{c.prefijo}</td>
                  <td className="px-3 py-2.5">{c.total_equipos}</td>
                  <td className={`px-3 py-2.5 ${c.total_equipos > 0 && c.disponibles < 2 ? 'font-semibold text-red-700' : ''}`}>{c.disponibles}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <button type="button" title="Renombrar" onClick={() => setModal({ categoria: c })} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50">
                        <Icono nombre="lapiz" className="h-4 w-4" />
                      </button>
                      <button type="button" title="Eliminar" onClick={() => setModal({ categoria: c, eliminar: true })} className="rounded-lg border border-red-200 p-1.5 text-red-700 hover:bg-red-50">
                        <Icono nombre="basura" className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
      {modal && (modal.eliminar ? <EliminarCategoria categoria={modal.categoria} alCerrar={() => setModal(null)} alTerminar={terminar} /> : <FormularioCategoria categoria={modal.categoria} alCerrar={() => setModal(null)} alTerminar={terminar} />)}
    </div>
  )
}

function FormularioCategoria({ categoria, alCerrar, alTerminar }) {
  const editar = Boolean(categoria)
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [prefijo, setPrefijo] = useState(categoria?.prefijo ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const prefijoFijo = editar && categoria.total_equipos > 0

  const guardar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const datos = { nombre: nombre.trim(), prefijo: prefijoFijo ? null : prefijo.trim().toUpperCase() }
      const r = editar ? await api(`/categorias/${categoria.id_categoria}`, { metodo: 'PUT', datos }) : await api('/categorias', { metodo: 'POST', datos })
      alTerminar(editar ? `Categoría «${r.nombre}» actualizada.` : `Categoría «${r.nombre}» creada con el prefijo ${r.prefijo}.`)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={editar ? 'Renombrar categoría' : 'Nueva categoría'} alCerrar={alCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <Entrada id="cat_nombre" etiqueta="Nombre" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} error={errorDe(error, 'nombre')} />
        <Entrada
          id="cat_prefijo"
          etiqueta="Prefijo del código"
          value={prefijo}
          maxLength={4}
          disabled={prefijoFijo}
          onChange={(e) => setPrefijo(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          ayuda={prefijoFijo ? 'No se puede cambiar porque la categoría ya tiene equipos' : '3 o 4 letras, ej. OSC → OSC-001'}
          error={errorDe(error, 'prefijo')}
        />
        {error && (
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" className={boton.secundario} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={boton.primario} disabled={!nombre.trim() || (!prefijoFijo && !/^[A-Z]{3,4}$/.test(prefijo)) || enviando}>
            {enviando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EliminarCategoria({ categoria, alCerrar, alTerminar }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const eliminar = async () => {
    setEnviando(true)
    try {
      await api(`/categorias/${categoria.id_categoria}`, { metodo: 'DELETE' })
      alTerminar(`Categoría «${categoria.nombre}» eliminada.`)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }
  return (
    <Modal titulo="Eliminar categoría" alCerrar={alCerrar}>
      <p className="text-sm text-slate-600">¿Eliminar «{categoria.nombre}»? Solo se permite si no tiene equipos asignados.</p>
      {error && (
        <div className="mt-3">
          <Mensaje tipo="error">{error.message}</Mensaje>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className={boton.secundario} onClick={alCerrar}>
          Cancelar
        </button>
        <button type="button" className={boton.peligro} onClick={eliminar} disabled={enviando}>
          Eliminar
        </button>
      </div>
    </Modal>
  )
}
