// Solicitudes y ventanilla del encargado: Pendientes (SRS 8.1, 8.2), Entrega (8.3 a 8.5)
// y Devolución (8.6 a 8.8). Los avisos de la campana abren aquí la pestaña y el folio.
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import TablaPendientes from '../../components/encargado/TablaPendientes'
import { Devolucion, Entrega } from '../../components/encargado/Ventanilla'
import { Pestanas } from '../../components/Formulario'
import Icono from '../../components/Icono'
import { Encabezado, Tarjeta } from '../../components/Pagina'

const OPCIONES = [
  { id: 'pendientes', texto: 'Pendientes', icono: <Icono nombre="reloj" className="h-4 w-4" /> },
  { id: 'entrega', texto: 'Entrega', icono: <Icono nombre="entrega" className="h-4 w-4" /> },
  { id: 'devolucion', texto: 'Devolución', icono: <Icono nombre="devolucion" className="h-4 w-4" /> },
]

export default function Solicitudes() {
  const { state } = useLocation()
  // Cada aviso trae una marca "vez" distinta: así se vuelve a abrir aunque ya estés en esta pantalla
  const [elegida, setElegida] = useState({ vez: null, pestana: 'pendientes' })
  const pestana = state?.vez && state.vez !== elegida.vez ? state.pestana : elegida.pestana
  const folio = state?.vez && state.vez !== elegida.vez ? state.folio : null
  const cambiar = (p) => setElegida({ vez: state?.vez ?? null, pestana: p })

  return (
    <div>
      <Encabezado antetitulo="Laboratorio de Microprocesadores" titulo="Solicitudes" descripcion="Aprueba o rechaza solicitudes y atiende la ventanilla de entrega y devolución." />
      <Pestanas opciones={OPCIONES} actual={pestana} alCambiar={cambiar} />
      {pestana === 'pendientes' && (
        <Tarjeta className="!p-0 overflow-hidden">
          <TablaPendientes />
        </Tarjeta>
      )}
      {pestana === 'entrega' && <Entrega key={`e-${folio ?? ''}-${state?.vez ?? ''}`} folio={folio} />}
      {pestana === 'devolucion' && <Devolucion key={`d-${folio ?? ''}-${state?.vez ?? ''}`} folio={folio} />}
    </div>
  )
}
