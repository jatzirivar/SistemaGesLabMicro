# Frontend · Sistema de Gestión de Préstamos del Laboratorio de Microprocesadores

Interfaz web en **React + Tailwind CSS** (creada con Vite).

## Primera vez

Requiere [Node.js LTS](https://nodejs.org).

```
cd frontend
npm install
```

## Cada vez que trabajes

Necesitas **dos terminales**:

| Terminal | Carpeta | Comando | Dirección |
|---|---|---|---|
| 1 | `servidor` (con `.venv` activado) | `uvicorn app.main:app --reload` | http://127.0.0.1:8000 |
| 2 | `frontend` | `npm run dev` | http://localhost:5173 |

Abre **http://localhost:5173**. Las peticiones a `/api` y `/uploads` se reenvían
al servidor automáticamente (ver `vite.config.js`).

## Estructura

```
src/
├── main.jsx            Punto de entrada
├── App.jsx             Mapa de pantallas (rutas)
├── index.css           Tailwind y colores del sistema (guinda y verde)
├── api/cliente.js      Peticiones al API con el token de sesión
├── context/            Sesión del usuario, carrito (se guarda en el navegador) y avisos
├── components/         Piezas reutilizables (íconos, mensajes, etiquetas de estado, modal...)
├── layouts/            Estructura del estudiante y del encargado (barra superior y menú ☰)
├── hooks/useApi.js     Consultas GET al API con carga y error
├── utils/formato.js    Fechas y horas en la zona de la Ciudad de México
└── pages/              Pantallas: login, estudiante/ y encargado/
    ├── estudiante/     Panel, Catálogo, Carrito, ConfigurarSolicitud, MisSolicitudes, DetalleSolicitud
    └── encargado/      Panel, Solicitudes (pendientes, entrega y devolución), Inventario,
                        Usuarios y FichaAlumno, Historial, Configuración
```

## Menú del encargado

Panel operativo · Solicitudes · Gestión de Inventario · Usuarios · Historial (SRS 8.15) · Configuración (SRS 8.14)
