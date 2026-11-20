// Usuarios (SRS 8.13): alumnos (búsqueda por nombre o boleta, registro manual, ficha)
// y encargados (lista y alta).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/cliente'
import Cargando from '../../components/Cargando'
import { CampoContrasena, ReglasContrasena, reglasContrasena } from '../../components/Campos'
import EtiquetaEstado from '../../components/EtiquetaEstado'
import { claseCampo, Entrada, errorDe, Paginacion, Pestanas } from '../../components/Formulario'
import Icono from '../../components/Icono'
import Mensaje from '../../components/Mensaje'
import Modal from '../../components/Modal'
import { boton, Encabezado, Tarjeta } from '../../components/Pagina'
import useApi from '../../hooks/useApi'

const MINIMO_ENCARGADO = 10

export default function Usuarios() {
  const [pestana, setPestana] = useState('alumnos')
  return (
    <div>
      <Encabezado antetitulo="Laboratorio de Microprocesadores" titulo="Usuarios" descripcion="Consulta y administra las cuentas de alumnos y encargados." />
      <Pestanas
        opciones={[
          { id: 'alumnos', texto: 'Alumnos', icono: <Icono nombre="usuarios" className="h-4 w-4" /> },
          { id: 'encargados', texto: 'Encargados', icono: <Icono nombre="usuario" className="h-4 w-4" /> },
        ]}
        actual={pestana}
        alCambiar={setPestana}
      />
      {pestana === 'alumnos' ? <Alumnos /> : <Encargados />}
    </div>
  )
}

export function EstadoCuenta({ a }) {
  if (a.suspendido) return <EtiquetaEstado estado="Suspendida" />
  if (a.sanciones_vigentes > 0) return <EtiquetaEstado estado="Sancionado" />
  if (a.bloqueado_temporalmente) return <EtiquetaEstado estado="Bloqueada" />
  return <EtiquetaEstado estado="Activa" />
}

function Alumnos() {
  const navegar = useNavigate()
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [registrar, setRegistrar] = useState(false)
  const [aviso, setAviso] = useState(null)
  const { datos, ultimo, error, cargando, recargar } = useApi('/encargado/estudiantes', { buscar: buscar.trim(), pagina })
  const lista = datos ?? ultimo

  return (
    <div className="space-y-4">
      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-60 flex-1">
          <span className="sr-only">Buscar alumno</span>
          <Icono nombre="buscar" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value)
              setPagina(1)
            }}
            placeholder="Buscar por nombre o boleta"
            className={`${claseCampo} pl-9`}
          />
        </label>
        <button type="button" className={boton.primario} onClick={() => setRegistrar(true)}>
          <Icono nombre="personaMas" className="h-4 w-4" /> Registrar alumno
        </button>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!lista && cargando && <Cargando texto="Cargando alumnos..." />}
      {lista && (
        <Tarjeta className="!p-0 overflow-hidden">
          {lista.elementos.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No se encontraron alumnos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full min-w-[48rem] text-left text-sm ${cargando ? 'opacity-60' : ''}`}>
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Boleta</th>
                    <th className="px-3 py-2.5">Nombre</th>
                    <th className="px-3 py-2.5">Correo</th>
                    <th className="px-3 py-2.5">Cuenta</th>
                    <th className="px-3 py-2.5">Préstamos activos</th>
                    <th className="px-4 py-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.elementos.map((a) => (
                    <tr key={a.id_estudiante}>
                      <td className="px-4 py-2.5 font-mono text-xs">{a.boleta}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{a.nombre_completo}</td>
                      <td className="px-3 py-2.5 text-slate-600">{a.correo}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <EstadoCuenta a={a} />
                          {a.tiene_adeudos && <EtiquetaEstado estado="Con adeudos" />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{a.prestamos_activos}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" onClick={() => navegar(`/encargado/usuarios/${a.id_estudiante}`)} className="inline-flex items-center gap-1 text-xs font-semibold text-verde-700 hover:underline">
                          Ver ficha <Icono nombre="flecha" className="h-3.5 w-3.5" />
                        </button>
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
      {registrar && (
        <RegistroAlumno
          alCerrar={() => setRegistrar(false)}
          alTerminar={(texto) => {
            setRegistrar(false)
            setAviso(texto)
            recargar()
          }}
        />
      )}
    </div>
  )
}

function RegistroAlumno({ alCerrar, alTerminar }) {
  const [d, setD] = useState({ nombre: '', apellido_pat: '', apellido_mat: '', boleta: '', correo: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const cambiar = (c) => (e) => setD((x) => ({ ...x, [c]: c === 'boleta' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value }))
  const completo = d.nombre.trim() && d.apellido_pat.trim() && d.boleta.length === 10 && d.correo.includes('@')

  const guardar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const r = await api('/encargado/estudiantes', { metodo: 'POST', datos: { ...d, apellido_mat: d.apellido_mat.trim() || null } })
      alTerminar(r.mensaje)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Registrar alumno" alCerrar={alCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <Entrada id="al_nombre" etiqueta="Nombre(s)" value={d.nombre} onChange={cambiar('nombre')} error={errorDe(error, 'nombre')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Entrada id="al_ap" etiqueta="Apellido paterno" value={d.apellido_pat} onChange={cambiar('apellido_pat')} error={errorDe(error, 'apellido_pat')} />
          <Entrada id="al_am" etiqueta="Apellido materno (opcional)" value={d.apellido_mat} onChange={cambiar('apellido_mat')} error={errorDe(error, 'apellido_mat')} />
        </div>
        <Entrada id="al_boleta" etiqueta="Boleta" inputMode="numeric" value={d.boleta} onChange={cambiar('boleta')} ayuda="10 dígitos" error={errorDe(error, 'boleta')} />
        <Entrada id="al_correo" type="email" etiqueta="Correo" value={d.correo} onChange={cambiar('correo')} error={errorDe(error, 'correo')} />
        <p className="text-xs text-slate-500">El alumno creará su contraseña con «¿Olvidaste tu contraseña?» en la pantalla de inicio de sesión.</p>
        {error && (
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className={boton.secundario} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={boton.primario} disabled={!completo || enviando}>
            {enviando ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Encargados() {
  const { datos, error, recargar } = useApi('/encargado/encargados')
  const [alta, setAlta] = useState(false)
  const [aviso, setAviso] = useState(null)
  return (
    <div className="space-y-4">
      {aviso && <Mensaje tipo="exito">{aviso}</Mensaje>}
      <div className="flex justify-end">
        <button type="button" className={boton.primario} onClick={() => setAlta(true)}>
          <Icono nombre="personaMas" className="h-4 w-4" /> Nuevo encargado
        </button>
      </div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {!datos && !error && <Cargando texto="Cargando encargados..." />}
      {datos && (
        <Tarjeta className="!p-0 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Correo</th>
                <th className="px-4 py-2.5">Cuenta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datos.map((e) => (
                <tr key={e.id_encargado}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{e.nombre_completo}</td>
                  <td className="px-3 py-2.5 text-slate-600">{e.correo}</td>
                  <td className="px-4 py-2.5">
                    <EtiquetaEstado estado={e.estado_cuenta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      )}
      {alta && (
        <AltaEncargado
          alCerrar={() => setAlta(false)}
          alTerminar={(texto) => {
            setAlta(false)
            setAviso(texto)
            recargar()
          }}
        />
      )}
    </div>
  )
}

function AltaEncargado({ alCerrar, alTerminar }) {
  const [d, setD] = useState({ nombre: '', apellido_pat: '', apellido_mat: '', correo: '', contrasena: '' })
  const [confirmacion, setConfirmacion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const cambiar = (c) => (e) => setD((x) => ({ ...x, [c]: e.target.value }))
  const contrasenaOk = reglasContrasena(d.contrasena, MINIMO_ENCARGADO).every((r) => r.cumple)
  const completo = d.nombre.trim() && d.apellido_pat.trim() && d.correo.includes('@') && contrasenaOk && confirmacion === d.contrasena

  const guardar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const r = await api('/encargado/encargados', { metodo: 'POST', datos: { ...d, apellido_mat: d.apellido_mat.trim() || null } })
      alTerminar(`Encargado ${r.nombre_completo} registrado. Ya puede iniciar sesión con ${r.correo}.`)
    } catch (err) {
      setError(err)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Nuevo encargado" alCerrar={alCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <Entrada id="en_nombre" etiqueta="Nombre(s)" value={d.nombre} onChange={cambiar('nombre')} error={errorDe(error, 'nombre')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Entrada id="en_ap" etiqueta="Apellido paterno" value={d.apellido_pat} onChange={cambiar('apellido_pat')} />
          <Entrada id="en_am" etiqueta="Apellido materno (opcional)" value={d.apellido_mat} onChange={cambiar('apellido_mat')} />
        </div>
        <Entrada id="en_correo" type="email" etiqueta="Correo" value={d.correo} onChange={cambiar('correo')} error={errorDe(error, 'correo')} />
        <CampoContrasena id="en_contrasena" etiqueta="Contraseña" value={d.contrasena} onChange={cambiar('contrasena')} ayuda={<ReglasContrasena valor={d.contrasena} minimo={MINIMO_ENCARGADO} />} />
        <CampoContrasena
          id="en_confirmacion"
          etiqueta="Confirmar contraseña"
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          error={confirmacion && confirmacion !== d.contrasena ? 'Las contraseñas no coinciden' : null}
        />
        {error && (
          <Mensaje tipo="error" errores={error.errores}>
            {error.message}
          </Mensaje>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className={boton.secundario} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={boton.primario} disabled={!completo || enviando}>
            {enviando ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
