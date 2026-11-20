// Íconos de línea sencillos (SVG), para no depender de otra librería.
const TRAZOS = {
  panel: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  solicitudes: 'M9 4h6v3H9zM7 6H5v15h14V6h-2M8 12h8M8 16h5',
  inventario: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  usuarios: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1a4 4 0 00-3-3.85M16 4.15a3.5 3.5 0 010 6.7',
  historial: 'M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8M3 3v5h5M12 7v5l3 2',
  configuracion: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  campana: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0',
  salir: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  usuario: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  catalogo: 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4',
  ojo: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  ojoTachado: 'M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A10.4 10.4 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.2M6.6 6.6A17.4 17.4 0 002 12s3.6 7 10 7a9.7 9.7 0 005.4-1.6',
  alerta: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cerrar: 'M6 6l12 12M18 6L6 18',
  carrito: 'M3 4h2l2.4 11.2a1.5 1.5 0 001.5 1.2h8.6a1.5 1.5 0 001.5-1.2L21 8H6.2M9 21h.01M18 21h.01',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  basura: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  buscar: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  check: 'M5 12l5 5L20 7',
  reloj: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  calendario: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  flechaIzq: 'M19 12H5M11 6l-6 6 6 6',
  descargar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  documento: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  escudo: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  caja: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
  lapiz: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  subir: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  candado: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  entrega: 'M3 12h12M11 8l4 4-4 4M15 4h5v16h-5',
  devolucion: 'M21 12H9M13 8l-4 4 4 4M9 4H4v16h5',
  personaMas: 'M15 20v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M8.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19 8v6M16 11h6',
  llave:'M15 7a4 4 0 11-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0115 7zM16 9h.01',
}

export default function Icono({ nombre, className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={TRAZOS[nombre] ?? ''} />
    </svg>
  )
}
