// Ficha del alumno (SRS 8.13 y 8.9): historial de préstamos e incidencias, sanciones,
// suspensión manual por adeudos y aplicación o retiro manual de sanciones.
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import DetallePrestamo from '../../components/encargado/DetallePrestamo'
import EtiquetaEstado from '../../components/EtiquetaEstado'
import { Seleccion, Texto } from '../../components/Formulario'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Tarjeta } from '../../components/Pagina'
import useApi from '../../hooks/useApi'
import { fecha, fechaHoraCorta } from '../../utils/formato'
import { EstadoCuenta } from './Usuarios'

const DURACION = { Retraso: '7 días naturales', Daño: '15 días naturales', Pérdida: 'indefinida (hasta retirarla manualmente)' }

export default function FichaAlumno() {
  const { pathname } = useLocation()
  const id = pathname.split('/').filter(Boolean).at(-1)
  const { datos, error, recargar } = useApi(`/encargado/estudiantes/${id}`)
  const [modal, setModal] = useState(null) // 'suspender' | 'sancion' | { retirar } | { folio }
  const [aviso, setAviso] = useState(null)

  const terminar = (texto) => {
    setModal(null)
    setAviso(texto)
    recargar()
  }

  const volver = (
    <Link to="/encargado/usuarios" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-verde-700 hover:underline">
      <Icono nombre="flechaIzq" className="h-4 w-4" /> Volver a Usuarios
    </Link>
  )
  if (error) {
    return (
      <div>
        {volver}
        <Mensaje tipo="error">{error}</Mensaje>
      </div>
    )
  }
  if (!datos) return <Cargando texto="Cargando ficha del alumno..." />
  const { alumno: a, prestamos, incidencias, sanciones } = datos

  return (
    <div>
      {volver}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-verde-700">Ficha del alumno</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{a.nombre_completo}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Boleta {a.boleta} · {a.correo}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <EstadoCuenta a={a} />
            {a.tiene_adeudos && <EtiquetaEstado estado="Con adeudos" />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={boton.secundario} onClick={() => setModal('suspender')}>
            <Icono nombre="candado" className="h-4 w-4" /> {a.suspendido ? 'Desbloquear solicitudes' : 'Bloquear solicitudes'}
          </button>
          <button type="button" className={boton.peligro} onClick={() => setModal('sancion')}>
            <Icono nombre="alerta" className="h-4 w-4" /> Aplicar sanción
          </button>
        </div>
      </div>

      {aviso && (
        <div className="mb-4">
          <Mensaje tipo="exito">{aviso}</Mensaje>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Tarjeta className="!p-0 min-w-0 overflow-hidden">
          <h2 className="px-5 pt-5 text-lg font-semibold text-slate-900">Historial de préstamos</h2>
          {prestamos.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Sin préstamos registrados.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {prestamos.map((p) => (
                <li key={p.folio}>
                  <button type="button" onClick={() => setModal({ folio: p.folio })} className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-semibold text-verde-700">{p.folio}</span>
                      <span className="block text-xs text-slate-500">
                        {p.equipos.map((e) => e.codigo_inventario).join(', ')} · retiro {fechaHoraCorta(p.fecha_hora_prog_retiro)}
                      </span>
                    </span>
                    <EtiquetaEstado estado={p.estado} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta>
            <h2 className="text-lg font-semibold text-slate-900">Sanciones</h2>
            {sanciones.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin sanciones.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sanciones.map((s) => (
                  <li key={s.id_sancion} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{s.tipo ?? 'Sanción'}</p>
                      <EtiquetaEstado estado={s.estado} />
                    </div>
                    <p className="text-xs text-slate-600">{s.motivo}</p>
                    <p className="text-[11px] text-slate-400">
                      Del {fecha(s.fecha_inicio)} {s.fecha_fin ? `al ${fecha(s.fecha_fin)}` : '· indefinida'}
                    </p>
                    {s.motivo_condonacion && <p className="text-[11px] text-slate-500">Retirada: {s.motivo_condonacion}</p>}
                    {s.estado === 'Vigente' && (
                      <button type="button" onClick={() => setModal({ retirar: s })} className="mt-2 text-xs font-semibold text-guinda-800 hover:underline">
                        Retirar sanción
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta>
            <h2 className="text-lg font-semibold text-slate-900">Incidencias</h2>
            {incidencias.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin incidencias.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {incidencias.map((i) => (
                  <li key={i.id_incidencia} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                    <p className="text-sm font-medium text-slate-900">
                      {i.tipo} · <span className="text-verde-700">{i.folio_prestamo}</span>
                    </p>
                    <p>
                      {i.equipo ? `${i.equipo} (${i.codigo_inventario}): ` : ''}
                      {i.descripcion}
                    </p>
                    <p>Resolución: {i.resolucion}</p>
                    <p className="text-[11px] text-slate-400">
                      {fechaHoraCorta(i.fecha_hora_registro)} · {i.registrada_por ?? 'Sistema'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>

      {modal === 'suspender' && <ModalSuspension alumno={a} alCerrar={() => setModal(null)} alTerminar={terminar} />}
      {modal === 'sancion' && <ModalSancion alumno={a} alCerrar={() => setModal(null)} alTerminar={terminar} />}
      {modal?.retirar && <ModalRetiro sancion={modal.retirar} alCerrar={() => setModal(null)} alTerminar={terminar} />}
      {modal?.folio && <DetallePrestamo folio={modal.folio} alCerrar={() => setModal(null)} />}
    </div>
  )
}

/** Acción con motivo: maneja envío y error. */
function useEnvio(alTerminar) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const enviar = async (accion, texto) => {
    setEnviando(true)
    setError(null)
    try {
      const r = await accion()
      alTerminar(typeof texto === 'function' ? texto(r) : texto)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }
  const caja = error && (
    <div className="mt-3">
      <Mensaje tipo="error" errores={error.errores}>
        {error.message}
      </Mensaje>
    </div>
  )
  return { enviando, enviar, caja }
}

function Pie({ alCerrar, texto, deshabilitado, onClick, peligro }) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <button type="button" className={boton.secundario} onClick={alCerrar}>
        Cancelar
      </button>
      <button type="button" className={peligro ? boton.peligro : boton.primario} disabled={deshabilitado} onClick={onClick}>
        {texto}
      </button>
    </div>
  )
}

/** SRS 8.13: bloquear o desbloquear el envío de solicitudes por adeudos. */
function ModalSuspension({ alumno, alCerrar, alTerminar }) {
  const suspender = !alumno.suspendido
  const [motivo, setMotivo] = useState('')
  const { enviando, enviar, caja } = useEnvio(alTerminar)
  return (
    <Modal titulo={suspender ? 'Bloquear solicitudes' : 'Desbloquear solicitudes'} alCerrar={alCerrar}>
      <p className="mb-3 text-sm text-slate-600">
        {suspender
          ? `${alumno.nombre_completo} no podrá enviar solicitudes hasta que lo desbloquees.`
          : `${alumno.nombre_completo} podrá volver a enviar solicitudes (si no tiene sanciones vigentes).`}
      </p>
      {suspender && <Texto id="motivo_susp" etiqueta="Motivo" value={motivo} maxLength={255} ayuda="Mínimo 5 caracteres (ej. Adeudo de cable BNC)" onChange={(e) => setMotivo(e.target.value)} />}
      {caja}
      <Pie
        alCerrar={alCerrar}
        texto={suspender ? 'Bloquear' : 'Desbloquear'}
        peligro={suspender}
        deshabilitado={enviando || (suspender && motivo.trim().length < 5)}
        onClick={() =>
          enviar(
            () => api(`/encargado/estudiantes/${alumno.id_estudiante}/suspension`, { metodo: 'PATCH', datos: { suspender, motivo: motivo.trim() || null } }),
            suspender ? 'Se bloqueó el envío de solicitudes del alumno.' : 'Se desbloqueó el envío de solicitudes del alumno.',
          )
        }
      />
    </Modal>
  )
}

/** SRS 8.9: sanción manual según el tipo de incidencia. */
function ModalSancion({ alumno, alCerrar, alTerminar }) {
  const [tipo, setTipo] = useState('Retraso')
  const [motivo, setMotivo] = useState('')
  const { enviando, enviar, caja } = useEnvio(alTerminar)
  return (
    <Modal titulo="Aplicar sanción" alCerrar={alCerrar}>
      <p className="mb-3 text-sm text-slate-600">Mientras esté vigente, {alumno.nombre_completo} no podrá enviar solicitudes ni recibir equipo en ventanilla.</p>
      <Seleccion id="tipo_sancion" etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} ayuda={`Duración: ${DURACION[tipo]}, a partir de hoy`}>
        <option value="Retraso">Retraso</option>
        <option value="Daño">Daño</option>
        <option value="Pérdida">Pérdida</option>
      </Seleccion>
      <Texto id="motivo_sancion" className="mt-3" etiqueta="Motivo" value={motivo} maxLength={255} ayuda="Mínimo 5 caracteres" onChange={(e) => setMotivo(e.target.value)} />
      {caja}
      <Pie
        alCerrar={alCerrar}
        texto="Aplicar sanción"
        peligro
        deshabilitado={enviando || motivo.trim().length < 5}
        onClick={() =>
          enviar(
            () => api('/encargado/sanciones', { metodo: 'POST', datos: { boleta: alumno.boleta, tipo, motivo: motivo.trim() } }),
            (s) => `Sanción por ${tipo} aplicada${s.fecha_fin ? ` hasta el ${fecha(s.fecha_fin)}` : ' (indefinida)'}.`,
          )
        }
      />
    </Modal>
  )
}

function ModalRetiro({ sancion, alCerrar, alTerminar }) {
  const [motivo, setMotivo] = useState('')
  const { enviando, enviar, caja } = useEnvio(alTerminar)
  return (
    <Modal titulo="Retirar sanción" alCerrar={alCerrar}>
      <p className="mb-3 text-sm text-slate-600">
        {sancion.tipo ?? 'Sanción'}: {sancion.motivo}. Quedará como Condonada.
      </p>
      <Texto id="motivo_retiro" etiqueta="Motivo del retiro" value={motivo} maxLength={255} ayuda="Mínimo 5 caracteres" onChange={(e) => setMotivo(e.target.value)} />
      {caja}
      <Pie
        alCerrar={alCerrar}
        texto="Retirar sanción"
        deshabilitado={enviando || motivo.trim().length < 5}
        onClick={() => enviar(() => api(`/encargado/sanciones/${sancion.id_sancion}/retirar`, { metodo: 'POST', datos: { motivo: motivo.trim() } }), 'Sanción retirada.')}
      />
    </Modal>
  )
}
