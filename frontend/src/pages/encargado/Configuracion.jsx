// Configuración del laboratorio (SRS 8.14): horario, duración máxima, límite de equipos,
// tolerancia de retiro y días inhábiles. Las duraciones de sanción son solo de consulta.
import { useState } from 'react'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import { Entrada } from '../../components/Formulario'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Encabezado, Tarjeta } from '../../components/Pagina'
import useApi from '../../hooks/useApi'
import { duracion, fecha, hoyISO } from '../../utils/formato'

export default function Configuracion() {
  const { datos, error, recargar } = useApi('/encargado/configuracion')
  const [aviso, setAviso] = useState(null)
  return (
    <div>
      <Encabezado antetitulo="Laboratorio de Microprocesadores" titulo="Configuración" descripcion="Parámetros globales del sistema de préstamos." />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {aviso && (
        <div className="mb-4">
          <Mensaje tipo="exito">{aviso}</Mensaje>
        </div>
      )}
      {!datos && !error && <Cargando texto="Cargando configuración..." />}
      {datos && (
        <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          <Parametros
            key={JSON.stringify(datos)}
            config={datos}
            alCambiar={() => setAviso(null)}
            alGuardar={() => {
              setAviso('Configuración guardada. Se aplica a las solicitudes nuevas.')
              recargar()
            }}
          />
          <DiasInhabiles />
        </div>
      )}
    </div>
  )
}

const corta = (t) => t.slice(0, 5)

function Parametros({ config, alGuardar, alCambiar }) {
  const [d, setD] = useState({
    horario_apertura: corta(config.horario_apertura),
    horario_cierre: corta(config.horario_cierre),
    hora_limite_devolucion: corta(config.hora_limite_devolucion),
    duracion_maxima: String(config.duracion_maxima),
    limite_equipos: String(config.limite_equipos),
    tolerancia_retiro: String(config.tolerancia_retiro),
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const cambiar = (c) => (e) => setD((x) => ({ ...x, [c]: e.target.value }))
  const completo = Object.values(d).every((v) => v !== '')

  const guardar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    alCambiar()
    try {
      await api('/encargado/configuracion', {
        metodo: 'PUT',
        datos: { ...d, duracion_maxima: Number(d.duracion_maxima), limite_equipos: Number(d.limite_equipos), tolerancia_retiro: Number(d.tolerancia_retiro) },
      })
      alGuardar()
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Tarjeta>
      <form onSubmit={guardar} noValidate>
        <h2 className="text-lg font-semibold text-slate-900">Horario y reglas de préstamo</h2>
        <p className="mb-4 text-xs text-slate-500">Días de servicio: {config.dias_servicio.join(', ')}.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Entrada id="c_apertura" type="time" step={1800} etiqueta="Primera hora de retiro" value={d.horario_apertura} onChange={cambiar('horario_apertura')} />
          <Entrada id="c_cierre" type="time" step={1800} etiqueta="Última hora de retiro" value={d.horario_cierre} onChange={cambiar('horario_cierre')} />
          <Entrada id="c_limite" type="time" step={1800} etiqueta="Hora límite de devolución" value={d.hora_limite_devolucion} onChange={cambiar('hora_limite_devolucion')} />
          <Entrada id="c_duracion" type="number" min={60} max={720} etiqueta="Duración máxima (min)" value={d.duracion_maxima} onChange={cambiar('duracion_maxima')} ayuda="Con prórroga, entre 60 y 720" />
          <Entrada id="c_limite_eq" type="number" min={1} max={20} etiqueta="Límite de equipos por estudiante" value={d.limite_equipos} onChange={cambiar('limite_equipos')} ayuda="Entre 1 y 20" />
          <Entrada id="c_tolerancia" type="number" min={0} max={120} etiqueta="Tolerancia de retiro (min)" value={d.tolerancia_retiro} onChange={cambiar('tolerancia_retiro')} ayuda="Entre 0 y 120" />
        </div>

        <h3 className="mt-6 text-sm font-semibold text-slate-900">Valores fijos (solo consulta)</h3>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <Dato t="Duración ordinaria del préstamo" v={duracion(config.duracion_ordinaria)} />
          <Dato t="Prórroga (una sola vez)" v={duracion(config.duracion_prorroga)} />
          <Dato t="Máximo del mismo equipo por solicitud" v={config.limite_por_modelo} />
          {config.duraciones_sancion.map((s) => (
            <Dato key={s.tipo} t={`Sanción por ${s.tipo}`} v={s.dias ? `${s.dias} días` : 'Indefinida'} />
          ))}
        </dl>

        {error && (
          <div className="mt-4">
            <Mensaje tipo="error" errores={error.errores}>
              {error.message}
            </Mensaje>
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button type="submit" className={boton.primario} disabled={!completo || enviando}>
            {enviando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Tarjeta>
  )
}

function Dato({ t, v }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{t}</dt>
      <dd className="font-medium text-slate-900">{v}</dd>
    </div>
  )
}

function DiasInhabiles() {
  const { datos, error, recargar } = useApi('/encargado/dias-inhabiles')
  const [nuevo, setNuevo] = useState({ fecha: '', descripcion: '' })
  const [enviando, setEnviando] = useState(false)
  const [errorAlta, setErrorAlta] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [eliminar, setEliminar] = useState(null)

  const agregar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setErrorAlta(null)
    setResultado(null)
    try {
      const r = await api('/encargado/dias-inhabiles', { metodo: 'POST', datos: { fecha: nuevo.fecha, descripcion: nuevo.descripcion.trim() } })
      setResultado(r)
      setNuevo({ fecha: '', descripcion: '' })
      recargar()
    } catch (err) {
      setErrorAlta(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Tarjeta className="h-fit">
      <h2 className="text-lg font-semibold text-slate-900">Días inhábiles</h2>
      <p className="mb-4 text-xs text-slate-500">No se pueden programar retiros en estos días.</p>
      <form onSubmit={agregar} className="space-y-3">
        <Entrada id="di_fecha" type="date" min={hoyISO()} etiqueta="Fecha" value={nuevo.fecha} onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))} />
        <Entrada id="di_desc" etiqueta="Descripción" maxLength={100} value={nuevo.descripcion} placeholder="Ej. Suspensión de labores" onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))} />
        <button type="submit" className={`${boton.primario} w-full`} disabled={!nuevo.fecha || nuevo.descripcion.trim().length < 3 || enviando}>
          <Icono nombre="mas" className="h-4 w-4" /> Agregar día inhábil
        </button>
      </form>
      {errorAlta && (
        <div className="mt-3">
          <Mensaje tipo="error" errores={errorAlta.errores}>
            {errorAlta.message}
          </Mensaje>
        </div>
      )}
      {resultado && (
        <div className="mt-3">
          <Mensaje tipo={resultado.solicitudes_afectadas.length ? 'aviso' : 'exito'}>
            {resultado.mensaje}
            {resultado.solicitudes_afectadas.length > 0 && ` Folios: ${resultado.solicitudes_afectadas.join(', ')}.`}
          </Mensaje>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <Mensaje tipo="error">{error}</Mensaje>
        </div>
      )}
      {datos && (
        <ul className="mt-4 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto border-t border-slate-200">
          {datos.length === 0 && <li className="py-4 text-center text-sm text-slate-500">No hay días inhábiles próximos.</li>}
          {datos.map((d) => (
            <li key={d.fecha} className="flex items-center justify-between gap-2 py-2.5">
              <span>
                <span className="block text-sm font-medium text-slate-900">{fecha(d.fecha)}</span>
                <span className="block text-xs text-slate-500">{d.descripcion}</span>
              </span>
              <button type="button" title="Eliminar" onClick={() => setEliminar(d)} className="rounded-lg p-1.5 text-red-700 hover:bg-red-50">
                <Icono nombre="basura" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {eliminar && (
        <EliminarDia
          dia={eliminar}
          alCerrar={() => setEliminar(null)}
          alTerminar={() => {
            setEliminar(null)
            recargar()
          }}
        />
      )}
    </Tarjeta>
  )
}

function EliminarDia({ dia, alCerrar, alTerminar }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Modal titulo="Eliminar día inhábil" alCerrar={alCerrar}>
      <p className="text-sm text-slate-600">
        ¿Eliminar el {fecha(dia.fecha)} ({dia.descripcion})? Ese día volverá a estar disponible para retiros.
      </p>
      {error && (
        <div className="mt-3">
          <Mensaje tipo="error">{error}</Mensaje>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" className={boton.secundario} onClick={alCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className={boton.peligro}
          disabled={enviando}
          onClick={async () => {
            setEnviando(true)
            try {
              await api(`/encargado/dias-inhabiles/${dia.fecha}`, { metodo: 'DELETE' })
              alTerminar()
            } catch (err) {
              setError(err.message)
              setEnviando(false)
            }
          }}
        >
          Eliminar
        </button>
      </div>
    </Modal>
  )
}
