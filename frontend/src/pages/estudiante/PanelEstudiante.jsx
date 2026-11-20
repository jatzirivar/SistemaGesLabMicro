// Pantalla 3: Panel del estudiante (SRS 3, 3.1, 3.2, 3.4 y 3.5).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/cliente'
import { ListaAvisos, useAbrirAviso } from '../../components/AccionesEstudiante'
import Cargando from '../../components/Cargando'
import EtiquetaEstado from '../../components/EtiquetaEstado'
import Icono from '../../components/Icono'
import IncidenciasSanciones from '../../components/IncidenciasSanciones'
import Mensaje from '../../components/Mensaje'
import { boton, Tarjeta } from '../../components/Pagina'
import SolicitudesPorEstado from '../../components/SolicitudesPorEstado'
import { useAuth } from '../../context/AuthContext'
import { useAvisos } from '../../context/AvisosContext'
import { dosDigitos, fecha, fechaHoraCorta, hoyLargo } from '../../utils/formato'

const ENTREGADA = 3
const VENCIDA = 4
const APROBADA = 2

export default function PanelEstudiante() {
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [pestana, setPestana] = useState('activos')

  useEffect(() => {
    let activo = true
    Promise.all([api('/estudiante/panel'), api('/solicitudes'), api('/estudiante/historial')])
      .then(([panel, solicitudes, historial]) => activo && setDatos({ panel, solicitudes, historial }))
      .catch((e) => activo && setError(e.message))
    return () => {
      activo = false
    }
  }, [])

  const { panel, solicitudes, historial } = datos ?? {}
  const fuera = panel?.prestamos_activos
    .filter((p) => [ENTREGADA, VENCIDA].includes(p.id_estado_prestamo))
    .sort((a, b) => a.fecha_hora_limite_devolucion.localeCompare(b.fecha_hora_limite_devolucion))
  const proxima = fuera?.[0]
  const retiro = panel?.prestamos_activos.find((p) => p.id_estado_prestamo === APROBADA)

  return (
    <div>
      <div className="mb-4 flex justify-end text-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <Icono nombre="calendario" className="h-4 w-4" /> {hoyLargo()}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-verde-700">Laboratorio de Microprocesadores</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">¿Qué haremos hoy, {usuario?.nombre}?</h1>
          <p className="mt-1 text-sm text-slate-500">Consulta tus solicitudes y mantén tus devoluciones al día.</p>
        </div>
        <Link to="/estudiante/catalogo" className={boton.primario}>
          <Icono nombre="mas" className="h-4 w-4" /> Explorar catálogo
        </Link>
      </div>

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!datos && !error && <Cargando texto="Cargando tu panel..." />}

      {datos && (
        <div className="space-y-6">
          {/* Banner rojo: sanción vigente, cuenta suspendida o adeudos (SRS 3.1) */}
          {panel.alertas.length > 0 && (
            <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
              <Icono nombre="alerta" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Por ahora no puedes solicitar equipo</p>
                <ul className="mt-1 list-disc pl-5">
                  {panel.alertas.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Contador icono="caja" numero={panel.prestamos_activos.length} titulo="Préstamos activos" detalle="Aprobados, entregados o vencidos" />
            <Contador icono="reloj" numero={panel.solicitudes_pendientes} titulo="Solicitudes en revisión" detalle="Pendientes de validación del laboratorio" color="amber" />
            <Contador
              icono="calendario"
              numero={fuera.length}
              titulo={fuera.length === 1 ? 'Devolución próxima' : 'Devoluciones próximas'}
              detalle={proxima ? `Vence el ${fechaHoraCorta(proxima.fecha_hora_limite_devolucion)}` : 'Sin equipo a tu cargo'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="min-w-0 space-y-6">
              {proxima ? (
                <Destacado
                  titulo="Próxima devolución"
                  cuando={fechaHoraCorta(proxima.fecha_hora_limite_devolucion)}
                  prestamo={proxima}
                  texto={
                    proxima.id_estado_prestamo === VENCIDA
                      ? 'Tu préstamo está vencido. Devuelve el equipo cuanto antes para evitar más días de sanción.'
                      : 'Entrega el equipo completo en el laboratorio antes de la hora límite.'
                  }
                />
              ) : (
                retiro && (
                  <Destacado
                    titulo="Próximo retiro"
                    cuando={fechaHoraCorta(retiro.fecha_hora_prog_retiro)}
                    prestamo={retiro}
                    texto="Tu solicitud fue aprobada. Muestra tu PIN en la ventanilla para recoger el equipo."
                  />
                )
              )}

              <Tarjeta className="!p-0 overflow-hidden">
                <div className="px-5 pt-5">
                  <h2 className="text-lg font-semibold text-slate-900">Mis solicitudes</h2>
                  <p className="text-xs text-slate-500">Seguimiento de tus préstamos y solicitudes.</p>
                </div>
                <div className="mt-3">
                  <SolicitudesPorEstado datos={solicitudes} pestana={pestana} alCambiar={setPestana} limite={5} />
                  {pestana === 'historial' && <IncidenciasSanciones historial={historial} />}
                </div>
                <div className="flex justify-end border-t border-slate-100 px-5 py-3">
                  <Link to="/estudiante/solicitudes" className="inline-flex items-center gap-1 text-sm font-semibold text-verde-700 hover:underline">
                    Ver todas mis solicitudes <Icono nombre="flecha" className="h-4 w-4" />
                  </Link>
                </div>
              </Tarjeta>
            </div>

            <div className="space-y-6">
              <TarjetaAvisos />
              <EstadoCuenta panel={panel} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Contador({ icono, numero, titulo, detalle, color = 'guinda' }) {
  const fondo = color === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-guinda-50 text-guinda-800'
  return (
    <div className="flex items-start gap-3 p-5">
      <span className={`rounded-lg p-2 ${fondo}`}>
        <Icono nombre={icono} className="h-5 w-5" />
      </span>
      <div>
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{dosDigitos(numero)}</span>
          <span className="text-sm font-semibold text-slate-800">{titulo}</span>
        </p>
        <p className="text-xs text-slate-500">{detalle}</p>
      </div>
    </div>
  )
}

function Destacado({ titulo, cuando, prestamo, texto }) {
  const vencida = prestamo.id_estado_prestamo === VENCIDA
  return (
    <section className={`rounded-2xl border p-5 ${vencida ? 'border-red-300 bg-red-50' : 'border-guinda-100 bg-guinda-50/60'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-guinda-800">
        <span className="flex items-center gap-2">
          <Icono nombre="calendario" className="h-4 w-4" /> {titulo}
        </span>
        <span className="font-medium normal-case tracking-normal text-slate-700">{cuando}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span className="hidden rounded-xl border border-slate-200 bg-white p-3 text-guinda-800 sm:block">
          <Icono nombre="caja" className="h-6 w-6" />
        </span>
        <div className="min-w-48 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
            {prestamo.equipos.map((e) => e.nombre).join(', ')}
            <EtiquetaEstado estado={prestamo.estado} />
            {prestamo.proximo_a_vencer && <EtiquetaEstado estado="Próximo a vencer" />}
          </p>
          <p className="text-xs text-slate-500">
            {prestamo.folio} · {prestamo.equipos.map((e) => e.codigo_inventario).join(', ')}
          </p>
          <p className="mt-1 text-sm text-slate-600">{texto}</p>
        </div>
        <Link to={`/estudiante/solicitudes/${prestamo.folio}`} className={`${boton.verde} w-full sm:w-auto`}>
          Ver préstamo
        </Link>
      </div>
    </section>
  )
}

function TarjetaAvisos() {
  const { lista, noLeidas, cargando, error, marcarTodas } = useAvisos()
  const abrir = useAbrirAviso()
  return (
    <Tarjeta className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h2 className="text-lg font-semibold text-slate-900">Avisos</h2>
        {noLeidas > 0 && <span className="rounded-full bg-verde-50 px-2.5 py-0.5 text-xs font-semibold text-verde-700">{noLeidas} sin leer</span>}
      </div>
      {cargando && <Cargando texto="Cargando avisos..." />}
      {error && <p className="px-5 pb-4 text-sm text-red-700">{error}</p>}
      {!cargando && !error && <ListaAvisos avisos={lista.slice(0, 4)} alAbrir={abrir} />}
      {noLeidas > 0 && (
        <button type="button" onClick={marcarTodas} className="w-full border-t border-slate-100 px-5 py-2.5 text-left text-xs font-medium text-guinda-800 hover:bg-slate-50">
          Marcar todos como leídos
        </button>
      )}
    </Tarjeta>
  )
}

function EstadoCuenta({ panel }) {
  const vencidos = panel.prestamos_activos.filter((p) => p.id_estado_prestamo === VENCIDA).length
  return (
    <Tarjeta>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Estado de cuenta</h2>
        <Icono nombre="escudo" className={`h-5 w-5 ${panel.puede_solicitar ? 'text-verde-700' : 'text-red-600'}`} />
      </div>

      {panel.sanciones_vigentes.length === 0 && !panel.cuenta_suspendida ? (
        <div className="flex gap-2 rounded-lg bg-verde-50 p-3 text-sm text-verde-800">
          <Icono nombre="check" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Sin sanciones activas</p>
            <p className="text-xs">{panel.puede_solicitar ? 'Puedes solicitar equipos.' : 'Revisa los avisos en rojo.'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {panel.cuenta_suspendida && (
            <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">Cuenta suspendida por el laboratorio</p>
          )}
          {panel.sanciones_vigentes.map((s) => (
            <div key={s.id_sancion} className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">{s.motivo}</p>
              <p className="text-xs">
                Del {fecha(s.fecha_inicio)} {s.fecha_fin ? `al ${fecha(s.fecha_fin)}` : '· sin fecha de fin'}
              </p>
            </div>
          ))}
        </div>
      )}

      <dl className="mt-4 divide-y divide-slate-100 text-sm">
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Devoluciones vencidas</dt>
          <dd className={`font-medium ${vencidos ? 'text-red-700' : 'text-slate-800'}`}>{vencidos || 'Ninguna'}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Adeudos de material</dt>
          <dd className={`font-medium ${panel.tiene_adeudos ? 'text-red-700' : 'text-slate-800'}`}>{panel.tiene_adeudos ? 'Sí' : 'Ninguno'}</dd>
        </div>
      </dl>
    </Tarjeta>
  )
}
