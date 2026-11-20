// Ventanilla del encargado.
//   Entrega (SRS 8.3, 8.4 y 8.5): búsqueda, verificaciones, checklist por código y PIN.
//   Devolución (SRS 8.6, 8.7 y 8.8): búsqueda, inspección de cada equipo e incidencias.
import { useEffect, useState } from 'react'
import { api } from '../../api/cliente'
import { fechaHora, fechaHoraCorta, hora } from '../../utils/formato'
import EtiquetaEstado from '../EtiquetaEstado'
import { claseCampo, Seleccion, Texto } from '../Formulario'
import Icono from '../Icono'
import Mensaje from '../Mensaje'
import Modal from '../Modal'
import { boton, Tarjeta } from '../Pagina'

/** Búsqueda por boleta o código; si llega `folio` (desde un aviso) abre ese préstamo directo. */
function useBusqueda(tipo, folio) {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)
  const [elegido, setElegido] = useState(null)

  const buscar = async (e) => {
    e?.preventDefault()
    if (!texto.trim()) return
    setBuscando(true)
    setError(null)
    setElegido(null)
    try {
      setResultado(await api(`/ventanilla/${tipo}`, { parametros: { buscar: texto.trim() } }))
    } catch (err) {
      setError(err.message)
      setResultado(null)
    } finally {
      setBuscando(false)
    }
  }

  const abrirFolio = async (f) => {
    setError(null)
    try {
      const p = await api(`/ventanilla/prestamos/${encodeURIComponent(f)}`)
      setResultado({ mensaje: null, prestamos: [p] })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (!folio) return
    const id = setTimeout(() => abrirFolio(folio), 0)
    return () => clearTimeout(id)
  }, [folio]) // eslint-disable-line react-hooks/exhaustive-deps

  const limpiar = () => {
    setElegido(null)
    setResultado(null)
    setTexto('')
  }
  return { texto, setTexto, resultado, buscando, error, buscar, elegido, setElegido, limpiar, abrirFolio }
}

function Buscador({ b, ayuda }) {
  return (
    <form onSubmit={b.buscar} className="flex flex-wrap gap-3">
      <label className="relative min-w-60 flex-1">
        <span className="sr-only">Boleta o código de equipo</span>
        <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={b.texto} onChange={(e) => b.setTexto(e.target.value)} placeholder={ayuda} className={`${claseCampo} pl-9`} />
      </label>
      <button type="submit" className={boton.primario} disabled={!b.texto.trim() || b.buscando}>
        {b.buscando ? 'Buscando...' : 'Buscar'}
      </button>
    </form>
  )
}

function TarjetaPrestamo({ p, accion, alElegir, entrega }) {
  const deshabilitado = entrega && !p.puede_continuar
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            {p.folio} <EtiquetaEstado estado={p.estado} />
          </p>
          <p className="text-sm text-slate-700">
            {p.estudiante} · {p.boleta} · Grupo {p.grupo}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Retiro {fechaHoraCorta(p.fecha_hora_prog_retiro)} · Devolución {hora(p.fecha_hora_limite_devolucion)} h{p.prorroga ? ' (con prórroga)' : ''}
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-slate-700">
            {p.equipos.map((e) => (
              <li key={e.codigo_inventario}>
                {e.nombre} · <span className="font-mono">{e.codigo_inventario}</span>
                {p.equipos_pendientes?.includes(e.codigo_inventario) && <span className="ml-1 font-semibold text-red-700">(pendiente)</span>}
              </li>
            ))}
          </ul>
        </div>
        <button type="button" className={boton.primario} disabled={deshabilitado} onClick={() => alElegir(p)}>
          {accion}
        </button>
      </div>
      {entrega && p.bloqueos.length > 0 && (
        <div className="mt-3">
          <Mensaje tipo="error" errores={p.bloqueos.map((m) => ({ mensaje: m }))}>
            No se puede entregar:
          </Mensaje>
        </div>
      )}
      {!entrega && p.minutos_de_retraso > 0 && !p.devolucion_registrada && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {p.minutos_de_retraso} min de retraso: al registrar la devolución se aplica automáticamente la incidencia de Retraso.
        </p>
      )}
    </div>
  )
}

function Resultados({ b, accion, entrega }) {
  if (b.error) return <Mensaje tipo="error">{b.error}</Mensaje>
  if (!b.resultado) return null
  if (b.resultado.prestamos.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-500">{b.resultado.mensaje}</p>
  }
  return (
    <div className="space-y-3">
      {b.resultado.prestamos.map((p) => (
        <TarjetaPrestamo key={p.folio} p={p} accion={accion} entrega={entrega} alElegir={b.setElegido} />
      ))}
    </div>
  )
}

/** Separa la lista de componentes registrada (por renglón o comas). */
function componentesDe(texto) {
  return (texto ?? '')
    .split(/\n|,|;/)
    .map((c) => c.trim())
    .filter(Boolean)
}

// ====================================================================== ENTREGA

export function Entrega({ folio }) {
  const b = useBusqueda('entregas', folio)
  const [listo, setListo] = useState(null)
  return (
    <div className="space-y-4">
      {listo && <Mensaje tipo="exito">{listo}</Mensaje>}
      {!b.elegido && (
        <>
          <Tarjeta>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Entrega de equipo</h2>
            <p className="mb-4 text-sm text-slate-500">Busca el préstamo aprobado con la boleta del estudiante (10 dígitos) o el código de un equipo.</p>
            <Buscador b={b} ayuda="Boleta o código de inventario (ej. 2023630001 u OSC-001)" />
          </Tarjeta>
          <Resultados b={b} accion="Entregar" entrega />
        </>
      )}
      {b.elegido && (
        <ChecklistEntrega
          prestamo={b.elegido}
          alVolver={() => b.setElegido(null)}
          alTerminar={(texto) => {
            setListo(texto)
            b.limpiar()
          }}
        />
      )}
    </div>
  )
}

function ChecklistEntrega({ prestamo, alVolver, alTerminar }) {
  const [componentes, setComponentes] = useState({}) // codigo -> lista de componentes
  const [verificados, setVerificados] = useState({}) // codigo -> { marcas: [bool], obs }
  const [codigo, setCodigo] = useState('')
  const [avisoCodigo, setAvisoCodigo] = useState(null)
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  // Lista de componentes registrada de cada equipo (inventario)
  useEffect(() => {
    let activo = true
    Promise.all(prestamo.equipos.map((e) => api(`/inventario/equipos/${encodeURIComponent(e.codigo_inventario)}`).catch(() => null))).then((lista) => {
      if (!activo) return
      const mapa = {}
      prestamo.equipos.forEach((e, i) => (mapa[e.codigo_inventario] = componentesDe(lista[i]?.componentes_incluidos)))
      setComponentes(mapa)
    })
    return () => {
      activo = false
    }
  }, [prestamo])

  // Acepta uno o varios códigos separados por coma, punto y coma o espacio (SRS 8.5:
  // se sigue escribiendo el código de cada equipo, pero en una sola captura)
  const verificar = async (e) => {
    e.preventDefault()
    const codigos = [...new Set(codigo.toUpperCase().split(/[\s,;]+/).filter(Boolean))]
    if (codigos.length === 0) return
    setAvisoCodigo(null)
    const nuevos = {}
    const repetidos = []
    const rechazados = []
    for (const c of codigos) {
      if (verificados[c]) {
        repetidos.push(c)
        continue
      }
      try {
        const r = await api(`/ventanilla/entregas/${encodeURIComponent(prestamo.folio)}/verificar-equipo`, { metodo: 'POST', datos: { codigo_inventario: c } })
        if (r.pertenece) {
          const n = Math.max(componentes[r.codigo_inventario]?.length ?? 0, 1)
          nuevos[r.codigo_inventario] = { marcas: Array(n).fill(false), obs: '' }
        } else {
          rechazados.push(c)
        }
      } catch (err) {
        rechazados.push(`${c} (${err.message})`)
      }
    }
    setVerificados((v) => ({ ...v, ...nuevos }))
    const avisos = []
    if (Object.keys(nuevos).length) avisos.push({ tipo: 'exito', texto: `Verificado: ${Object.keys(nuevos).join(', ')}.` })
    if (repetidos.length) avisos.push({ tipo: 'aviso', texto: `Ya se había verificado: ${repetidos.join(', ')}.` })
    if (rechazados.length) avisos.push({ tipo: 'error', texto: `No pertenece al préstamo ${prestamo.folio}: ${rechazados.join(', ')}.` })
    setAvisoCodigo(avisos)
    setCodigo('')
  }

  const marcar = (c, i, valor) => setVerificados((v) => ({ ...v, [c]: { ...v[c], marcas: v[c].marcas.map((m, j) => (j === i ? valor : m)) } }))
  const todos = prestamo.equipos.every((e) => verificados[e.codigo_inventario])
  const pinValido = /^\d{4}$/.test(pin)

  const registrar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await api(`/ventanilla/entregas/${encodeURIComponent(prestamo.folio)}`, {
        metodo: 'POST',
        datos: {
          pin,
          equipos: prestamo.equipos.map((e) => {
            const v = verificados[e.codigo_inventario]
            return { codigo_inventario: e.codigo_inventario, entregado_completo: v.marcas.every(Boolean), observaciones: v.obs.trim() || null }
          }),
        },
      })
      alTerminar(`Entrega registrada: ${prestamo.folio} quedó como Entregada y sus equipos como Prestado.`)
    } catch (err) {
      setError(err)
      setPin('')
      setEnviando(false)
    }
  }

  return (
    <Tarjeta>
      <button type="button" onClick={alVolver} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-verde-700 hover:underline">
        <Icono nombre="flechaIzq" className="h-4 w-4" /> Volver a la búsqueda
      </button>
      <h2 className="text-lg font-semibold text-slate-900">Entrega de {prestamo.folio}</h2>
      <p className="text-sm text-slate-600">
        {prestamo.estudiante} · {prestamo.boleta} · retiro {fechaHora(prestamo.fecha_hora_prog_retiro)}
      </p>

      <h3 className="mt-6 text-sm font-semibold text-slate-900">1. Escribe el código de cada equipo</h3>
      <p className="text-xs text-slate-500">Puedes escribir varios a la vez, separados por coma o espacio.</p>
      <form onSubmit={verificar} className="mt-2 flex flex-wrap gap-3">
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. GEN-001, MULT-002, OSC-008" aria-label="Código del equipo" className={`${claseCampo} max-w-md font-mono uppercase`} />
        <button type="submit" className={boton.secundario} disabled={!codigo.trim()}>
          Verificar
        </button>
      </form>
      {avisoCodigo?.map((a) => (
        <div key={a.tipo} className="mt-2">
          <Mensaje tipo={a.tipo}>{a.texto}</Mensaje>
        </div>
      ))}

      {/* Avance del paso 1: solo nombres, sin códigos, para que el encargado los lea de cada equipo */}
      <ul className="mt-3 flex flex-wrap gap-2">
        {prestamo.equipos.map((e) => (
          <li
            key={e.codigo_inventario}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              verificados[e.codigo_inventario] ? 'bg-verde-50 text-verde-800' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Icono nombre={verificados[e.codigo_inventario] ? 'check' : 'candado'} className="h-3.5 w-3.5" />
            {e.nombre}
          </li>
        ))}
      </ul>
      {!todos && (
        <p className="mt-2 text-xs text-slate-500">
          Verificados {Object.keys(verificados).length} de {prestamo.equipos.length}. Los componentes y el PIN aparecen al verificar todos los códigos.
        </p>
      )}

      {todos && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-slate-900">2. Revisa los componentes de cada equipo</h3>
          <ul className="mt-2 space-y-3">
            {prestamo.equipos.map((e) => {
              const v = verificados[e.codigo_inventario]
              const lista = componentes[e.codigo_inventario] ?? []
              return (
                <li key={e.codigo_inventario} className="rounded-xl border border-verde-600/40 bg-verde-50/40 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Icono nombre="check" className="h-4 w-4 text-verde-700" />
                    {e.nombre} · <span className="font-mono">{e.codigo_inventario}</span>
                  </p>
                  <div className="mt-3 space-y-2">
                    {lista.length > 0 ? (
                      lista.map((comp, i) => (
                        <label key={comp} className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={v.marcas[i]} onChange={(ev) => marcar(e.codigo_inventario, i, ev.target.checked)} className="h-4 w-4 accent-guinda-800" />
                          {comp}
                        </label>
                      ))
                    ) : (
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={v.marcas[0]} onChange={(ev) => marcar(e.codigo_inventario, 0, ev.target.checked)} className="h-4 w-4 accent-guinda-800" />
                        Se entrega completo
                      </label>
                    )}
                    {!v.marcas.every(Boolean) && <p className="text-xs text-amber-700">Si no marcas todas las casillas, se registrará como entregado incompleto.</p>}
                    <Texto
                      id={`obs-${e.codigo_inventario}`}
                      etiqueta="Observaciones (opcional)"
                      value={v.obs}
                      maxLength={255}
                      rows={2}
                      onChange={(ev) => setVerificados((x) => ({ ...x, [e.codigo_inventario]: { ...x[e.codigo_inventario], obs: ev.target.value } }))}
                    />
                  </div>
                </li>
              )
            })}
          </ul>

          <h3 className="mt-6 text-sm font-semibold text-slate-900">3. PIN de 4 dígitos que muestra el estudiante</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="••••"
              aria-label="PIN"
              className={`${claseCampo.replace('w-full', 'w-36')} text-center font-mono text-2xl tracking-[0.5em]`}
            />
            <button type="button" className={boton.primario} disabled={!pinValido || enviando} onClick={registrar}>
              {enviando ? 'Registrando...' : 'Registrar entrega'}
            </button>
          </div>
        </>
      )}
      {error && (
        <div className="mt-3">
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        </div>
      )}
    </Tarjeta>
  )
}

// ====================================================================== DEVOLUCIÓN

export function Devolucion({ folio }) {
  const b = useBusqueda('devoluciones', folio)
  const [listo, setListo] = useState(null)
  return (
    <div className="space-y-4">
      {listo && <ResultadoFinal r={listo} alCerrar={() => setListo(null)} />}
      {!b.elegido && (
        <>
          <Tarjeta>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">Devolución de equipo</h2>
            <p className="mb-4 text-sm text-slate-500">Busca el préstamo entregado o vencido con la boleta del estudiante o el código de cualquiera de sus equipos.</p>
            <Buscador b={b} ayuda="Boleta o código de inventario" />
          </Tarjeta>
          <Resultados b={b} accion="Registrar devolución" />
        </>
      )}
      {b.elegido &&
        (b.elegido.devolucion_registrada ? (
          <ResolverPendientes
            prestamo={b.elegido}
            alVolver={() => b.setElegido(null)}
            alTerminar={(r) => {
              setListo(r)
              if (r.prestamo_cerrado) b.limpiar()
              else b.abrirFolio(r.folio).then(() => b.setElegido(null))
            }}
          />
        ) : (
          <Inspeccion
            prestamo={b.elegido}
            alVolver={() => b.setElegido(null)}
            alTerminar={(r) => {
              setListo(r)
              b.limpiar()
            }}
          />
        ))}
    </div>
  )
}

function ResultadoFinal({ r, alCerrar }) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${r.prestamo_cerrado ? 'border-verde-600/30 bg-verde-50 text-verde-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`} role="status">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{r.mensaje}</p>
        <button type="button" onClick={alCerrar} title="Cerrar" className="opacity-60 hover:opacity-100">
          <Icono nombre="cerrar" className="h-4 w-4" />
        </button>
      </div>
      {r.equipos_pendientes.length > 0 && <p className="mt-1">Equipos pendientes de resolver: {r.equipos_pendientes.join(', ')}. El préstamo sigue abierto.</p>}
      {r.incidencias.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {r.incidencias.map((i) => (
            <li key={i.id_incidencia}>
              Incidencia de {i.tipo}
              {i.codigo_inventario ? ` (${i.codigo_inventario})` : ''}: {i.descripcion}
            </li>
          ))}
        </ul>
      )}
      {r.sanciones.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {r.sanciones.map((s) => (
            <li key={s.id_sancion}>
              Sanción por {s.tipo ?? 'incidencia'}: {s.motivo}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Tipos de incidencia que ve el encargado y cómo se registran (SRS 8.6, 8.7 y 8.9)
const TIPOS = {
  Dañado: { estado: 'Dañado', tipo: 'Daño', efecto: 'El equipo pasa a "En mantenimiento" y se aplica una sanción de 15 días.' },
  Incompleto: { estado: 'Incompleto', tipo: 'Daño', efecto: 'Falta un componente: el equipo pasa a "En mantenimiento" y se aplica una sanción de 15 días.' },
  Retraso: { estado: 'Bueno', tipo: 'Retraso', efecto: 'El equipo regresa como Disponible y se aplica una sanción de 7 días (una sola por préstamo).' },
  Pérdida: { estado: 'Incompleto', tipo: 'Pérdida', efecto: 'El equipo no se devolvió: se da de baja del catálogo y la sanción es indefinida.' },
}

function Inspeccion({ prestamo, alVolver, alTerminar }) {
  const [revision, setRevision] = useState({}) // codigo -> { resultado: 'Bueno' | 'Incidencia', tipo, incidencia, obs }
  const [modal, setModal] = useState(null) // codigo del equipo al que se le captura la incidencia
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const cambiar = (codigo, valores) => setRevision((r) => ({ ...r, [codigo]: { ...r[codigo], ...valores } }))
  const completos = prestamo.equipos.every((e) => {
    const v = revision[e.codigo_inventario]
    return v?.resultado === 'Bueno' || (v?.resultado === 'Incidencia' && v.incidencia)
  })

  const registrar = async () => {
    setEnviando(true)
    setError(null)
    try {
      const r = await api(`/ventanilla/devoluciones/${encodeURIComponent(prestamo.folio)}`, {
        metodo: 'POST',
        datos: {
          equipos: prestamo.equipos.map((e) => {
            const v = revision[e.codigo_inventario]
            const obs = v.obs?.trim() || null
            if (v.resultado === 'Bueno') return { codigo_inventario: e.codigo_inventario, estado: 'Bueno', observaciones: obs, incidencia: null }
            const t = TIPOS[v.tipo]
            return {
              codigo_inventario: e.codigo_inventario,
              estado: t.estado,
              observaciones: obs,
              incidencia: { tipo: t.tipo, descripcion: v.incidencia.descripcion, resolucion: v.incidencia.resolucion },
            }
          }),
        },
      })
      alTerminar(r)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Tarjeta>
      <button type="button" onClick={alVolver} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-verde-700 hover:underline">
        <Icono nombre="flechaIzq" className="h-4 w-4" /> Volver a la búsqueda
      </button>
      <h2 className="text-lg font-semibold text-slate-900">Devolución de {prestamo.folio}</h2>
      <p className="text-sm text-slate-600">
        {prestamo.estudiante} · {prestamo.boleta} · límite {fechaHora(prestamo.fecha_hora_limite_devolucion)}
      </p>
      {prestamo.minutos_de_retraso > 0 && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {prestamo.minutos_de_retraso} min de retraso: se registrará la incidencia de Retraso automáticamente.
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold text-slate-900">Inspección de cada equipo</h3>
      <ul className="mt-2 space-y-3">
        {prestamo.equipos.map((e) => {
          const v = revision[e.codigo_inventario]
          return (
            <li key={e.codigo_inventario} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {e.nombre} · <span className="font-mono">{e.codigo_inventario}</span>
              </p>
              {e.obs_entrega && <p className="text-xs text-slate-500">Al entregar: {e.obs_entrega}</p>}
              {e.entregado_completo === false && <p className="text-xs text-amber-700">Se entregó incompleto.</p>}
              <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={`Estado de ${e.codigo_inventario}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={v?.resultado === 'Bueno'}
                  onClick={() => cambiar(e.codigo_inventario, { resultado: 'Bueno', tipo: null, incidencia: null })}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                    v?.resultado === 'Bueno' ? 'border-verde-700 bg-verde-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  Bueno
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={v?.resultado === 'Incidencia'}
                  onClick={() => setModal(e.codigo_inventario)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                    v?.resultado === 'Incidencia' ? 'border-red-700 bg-red-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  Incidencia
                </button>
              </div>
              {v?.resultado === 'Incidencia' && v.incidencia && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  <p className="font-semibold">Incidencia: {v.tipo}</p>
                  <p>Evidencia: {v.incidencia.descripcion}</p>
                  <p>Resolución: {v.incidencia.resolucion}</p>
                  <button type="button" onClick={() => setModal(e.codigo_inventario)} className="mt-1 font-medium underline">
                    Editar incidencia
                  </button>
                </div>
              )}
              {v?.resultado && (
                <Texto
                  id={`obsdev-${e.codigo_inventario}`}
                  className="mt-3"
                  etiqueta="Observaciones (opcional)"
                  rows={2}
                  maxLength={255}
                  value={v.obs ?? ''}
                  onChange={(ev) => cambiar(e.codigo_inventario, { obs: ev.target.value })}
                />
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <div className="mt-4">
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <button type="button" className={boton.primario} disabled={!completos || enviando} onClick={registrar}>
          {enviando ? 'Registrando...' : 'Registrar devolución'}
        </button>
      </div>

      {modal && (
        <ModalIncidencia
          prestamo={prestamo}
          equipo={prestamo.equipos.find((x) => x.codigo_inventario === modal)}
          inicial={revision[modal]?.resultado === 'Incidencia' ? revision[modal] : null}
          alCancelar={() => setModal(null)}
          alGuardar={(tipo, incidencia) => {
            cambiar(modal, { resultado: 'Incidencia', tipo, incidencia })
            setModal(null)
          }}
        />
      )}
    </Tarjeta>
  )
}

/** SRS 8.7: tipo de incidencia, evidencia descriptiva y resolución aplicada (5 a 255 caracteres).
 *  Queda vinculada al folio, al estudiante y al equipo. */
function ModalIncidencia({ prestamo, equipo, inicial, alCancelar, alGuardar }) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.incidencia?.descripcion ?? '')
  const [resolucion, setResolucion] = useState(inicial?.incidencia?.resolucion ?? '')
  const valido = tipo && descripcion.trim().length >= 5 && resolucion.trim().length >= 5
  return (
    <Modal titulo="Registro de incidencia" alCerrar={alCancelar}>
      <dl className="mb-4 grid grid-cols-[6rem_1fr] gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <dt className="text-slate-500">Folio</dt>
        <dd className="font-medium">{prestamo.folio}</dd>
        <dt className="text-slate-500">Estudiante</dt>
        <dd className="font-medium">
          {prestamo.estudiante} · {prestamo.boleta}
        </dd>
        <dt className="text-slate-500">Equipo</dt>
        <dd className="font-medium">
          {equipo.nombre} · <span className="font-mono">{equipo.codigo_inventario}</span>
        </dd>
      </dl>
      <Seleccion id="tipo_incidencia" etiqueta="Tipo de incidencia" value={tipo} onChange={(e) => setTipo(e.target.value)} ayuda={TIPOS[tipo]?.efecto}>
        <option value="">Selecciona...</option>
        {Object.keys(TIPOS).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Seleccion>
      {tipo === 'Retraso' && prestamo.minutos_de_retraso > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Este préstamo ya tiene el Retraso automático ({prestamo.minutos_de_retraso} min): no se registrará un segundo Retraso.
        </p>
      )}
      <Texto id="evidencia" className="mt-3" etiqueta="Evidencia descriptiva" value={descripcion} maxLength={255} ayuda="Mínimo 5 caracteres" onChange={(e) => setDescripcion(e.target.value)} />
      <Texto id="resolucion" className="mt-3" etiqueta="Resolución aplicada" value={resolucion} maxLength={255} ayuda="Mínimo 5 caracteres" onChange={(e) => setResolucion(e.target.value)} />
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className={boton.secundario} onClick={alCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className={boton.primario}
          disabled={!valido}
          onClick={() => alGuardar(tipo, { descripcion: descripcion.trim(), resolucion: resolucion.trim() })}
        >
          Guardar incidencia
        </button>
      </div>
    </Modal>
  )
}

/** Préstamo ya inspeccionado que quedó abierto: se resuelve equipo por equipo. */
function ResolverPendientes({ prestamo, alVolver, alTerminar }) {
  const [codigo, setCodigo] = useState(null)
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  const resolver = async () => {
    setEnviando(true)
    setError(null)
    try {
      const r = await api(`/ventanilla/devoluciones/${encodeURIComponent(prestamo.folio)}/equipos/${encodeURIComponent(codigo)}/resolver`, {
        metodo: 'POST',
        datos: { observaciones: obs.trim() },
      })
      setCodigo(null)
      setObs('')
      alTerminar(r)
    } catch (err) {
      setError(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta>
      <button type="button" onClick={alVolver} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-verde-700 hover:underline">
        <Icono nombre="flechaIzq" className="h-4 w-4" /> Volver a la búsqueda
      </button>
      <h2 className="text-lg font-semibold text-slate-900">Pendientes de {prestamo.folio}</h2>
      <p className="text-sm text-slate-600">
        La devolución ya se registró, pero quedaron equipos dañados o incompletos. El préstamo se cierra cuando todos estén resueltos (por ejemplo, el alumno repuso el componente).
      </p>
      <ul className="mt-4 space-y-2">
        {prestamo.equipos
          .filter((e) => prestamo.equipos_pendientes.includes(e.codigo_inventario))
          .map((e) => (
            <li key={e.codigo_inventario} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <span className="text-sm">
                {e.nombre} · <span className="font-mono">{e.codigo_inventario}</span> {e.inspeccion_devolucion && <EtiquetaEstado estado={e.inspeccion_devolucion} />}
              </span>
              <button type="button" className={boton.verde} onClick={() => setCodigo(e.codigo_inventario)}>
                Marcar como resuelto
              </button>
            </li>
          ))}
      </ul>
      {codigo && (
        <Modal titulo={`Resolver ${codigo}`} alCerrar={() => setCodigo(null)}>
          <Texto id="obs_resolver" etiqueta="¿Cómo se resolvió?" value={obs} maxLength={200} ayuda="Mínimo 5 caracteres (ej. El alumno repuso el cable BNC)" onChange={(e) => setObs(e.target.value)} />
          {error && (
            <div className="mt-3">
              <Mensaje tipo="error" errores={error.errores}>
                {error.message}
              </Mensaje>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className={boton.secundario} onClick={() => setCodigo(null)}>
              Cancelar
            </button>
            <button type="button" className={boton.primario} disabled={obs.trim().length < 5 || enviando} onClick={resolver}>
              {enviando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </Tarjeta>
  )
}

