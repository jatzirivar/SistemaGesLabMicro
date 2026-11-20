// Pantalla 5: Carrito de solicitud (SRS 5, 5.1). Agrupa las piezas por equipo:
// el campo numérico con + y − agrega o quita piezas del mismo equipo (máximo 2).
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api/cliente'
import FotoEquipo from '../../components/FotoEquipo'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Encabezado, Pasos, Tarjeta } from '../../components/Pagina'
import { useCarrito } from '../../context/CarritoContext'

/** Agrupa las piezas del carrito por nombre del equipo, en el orden en que se agregaron. */
export function agrupar(equipos) {
  const grupos = new Map()
  for (const e of equipos) {
    if (!grupos.has(e.nombre)) grupos.set(e.nombre, { nombre: e.nombre, categoria: e.categoria, foto_url: e.foto_url, piezas: [] })
    grupos.get(e.nombre).piezas.push(e)
  }
  return [...grupos.values()]
}

export default function Carrito() {
  const carrito = useCarrito()
  const navegar = useNavigate()
  const [aviso, setAviso] = useState(null)
  const [buscando, setBuscando] = useState(null)
  const [confirmarVaciar, setConfirmarVaciar] = useState(false)
  const grupos = agrupar(carrito.equipos)

  /** "+": busca otra pieza disponible del mismo equipo que no esté ya en el carrito. */
  const agregarOtra = async (grupo) => {
    setAviso(null)
    setBuscando(grupo.nombre)
    try {
      const r = await api('/catalogo', { parametros: { buscar: grupo.nombre, disponibilidad: 'Disponible', por_pagina: 100 } })
      const libre = r.elementos.find((e) => e.nombre === grupo.nombre && e.se_puede_agregar && !carrito.tiene(e.codigo_inventario))
      if (libre) carrito.agregar(libre)
      else setAviso(`No hay otra pieza disponible de «${grupo.nombre}» en este momento.`)
    } catch (e) {
      setAviso(e.message)
    } finally {
      setBuscando(null)
    }
  }

  return (
    <div>
      <Encabezado
        antetitulo="Solicitud de préstamo"
        titulo="Revisa tu carrito"
        descripcion="Verifica los equipos seleccionados antes de continuar."
        derecha={<Pasos actual={2} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Tarjeta>
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Icono nombre="carrito" className="h-5 w-5 text-guinda-800" /> Equipos seleccionados
            </h2>
            <span className="text-sm text-slate-500">
              {carrito.total} {carrito.total === 1 ? 'equipo' : 'equipos'}
            </span>
          </div>

          {aviso && (
            <div className="mt-4">
              <Mensaje tipo="aviso">{aviso}</Mensaje>
            </div>
          )}

          {grupos.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">Tu carrito está vacío.</p>
              <Link to="/estudiante/catalogo" className={`${boton.primario} mt-4`}>
                Ir al catálogo
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {grupos.map((g) => {
                const cantidad = g.piezas.length
                const sinMas = cantidad >= carrito.limiteModelo || carrito.total >= carrito.limiteTotal
                return (
                  <li key={g.nombre} className="flex flex-wrap items-center gap-4 py-4">
                    <FotoEquipo url={g.foto_url} nombre={g.nombre} className="h-16 w-20 shrink-0 rounded-lg" />
                    <div className="min-w-40 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-verde-700">{g.categoria}</p>
                      <p className="font-semibold text-slate-900">{g.nombre}</p>
                      <p className="text-xs text-slate-500">Código: {g.piezas.map((p) => p.codigo_inventario).join(', ')}</p>
                    </div>
                    <div className="text-center">
                      <p className="mb-1 text-[11px] text-slate-500">Cantidad</p>
                      <div className="flex items-center rounded-lg border border-slate-300">
                        <button
                          type="button"
                          title="Quitar una pieza"
                          onClick={() => carrito.quitar(g.piezas.at(-1).codigo_inventario)}
                          className="px-2.5 py-2 text-slate-600 hover:bg-slate-50"
                        >
                          <Icono nombre="menos" className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold" aria-label={`Cantidad de ${g.nombre}`}>
                          {cantidad}
                        </span>
                        <button
                          type="button"
                          title="Agregar otra pieza"
                          disabled={sinMas || buscando === g.nombre}
                          onClick={() => agregarOtra(g)}
                          className="px-2.5 py-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                        >
                          <Icono nombre="mas" className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Máximo {carrito.limiteModelo}</p>
                    </div>
                    <button
                      type="button"
                      title="Eliminar del carrito"
                      onClick={() => carrito.quitarModelo(g.nombre)}
                      className="rounded-lg bg-red-50 p-2.5 text-red-700 hover:bg-red-100"
                    >
                      <Icono nombre="basura" className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <Link to="/estudiante/catalogo" className="inline-flex items-center gap-1 text-sm font-semibold text-verde-700 hover:underline">
              <Icono nombre="flechaIzq" className="h-4 w-4" /> Seguir agregando equipos
            </Link>
            {grupos.length > 0 && (
              <button type="button" onClick={() => setConfirmarVaciar(true)} className="text-sm font-medium text-red-700 hover:underline">
                Vaciar carrito
              </button>
            )}
          </div>
        </Tarjeta>

        <Tarjeta className="h-fit">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-verde-700">Resumen</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Tu solicitud</h2>
          <dl className="mt-4 divide-y divide-slate-200 text-sm">
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Tipos de equipo</dt>
              <dd className="font-semibold">{grupos.length}</dd>
            </div>
            <div className="flex justify-between py-3">
              <dt className="text-slate-500">Unidades totales</dt>
              <dd className="font-semibold">
                {carrito.total} de {carrito.limiteTotal}
              </dd>
            </div>
          </dl>
          <div className="mt-2 flex gap-2 rounded-lg bg-verde-50 p-3 text-xs text-verde-800">
            <Icono nombre="escudo" className="h-4 w-4 shrink-0" />
            Podrás indicar la fecha y el horario en el siguiente paso.
          </div>
          <button
            type="button"
            disabled={carrito.total === 0}
            onClick={() => navegar('/estudiante/carrito/configurar')}
            className={`${boton.primario} mt-4 w-full py-3`}
          >
            Configurar solicitud <Icono nombre="flecha" className="h-4 w-4" />
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-400">Tu selección se guardará temporalmente en este navegador.</p>
        </Tarjeta>
      </div>

      {confirmarVaciar && (
        <Modal titulo="¿Vaciar el carrito?" alCerrar={() => setConfirmarVaciar(false)}>
          <p className="text-sm text-slate-600">Se quitarán todos los equipos seleccionados.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={boton.secundario} onClick={() => setConfirmarVaciar(false)}>
              No, conservar
            </button>
            <button
              type="button"
              className={boton.peligro}
              onClick={() => {
                carrito.vaciar()
                setConfirmarVaciar(false)
              }}
            >
              Vaciar carrito
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
