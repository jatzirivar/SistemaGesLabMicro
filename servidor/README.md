# Servidor · Sistema de Gestión de Préstamos del Laboratorio de Microprocesadores

API REST en Python + FastAPI + PostgreSQL.

## Estructura

```
servidor/
├── app/
│   ├── main.py        Punto de entrada: crea la app y registra las rutas
│   ├── core/          Configuración (.env), conexión a BD y seguridad
│   ├── models/        Tablas de la BD como clases de Python (SQLAlchemy)
│   ├── schemas/       Formato de los datos que entran y salen en JSON (Pydantic)
│   ├── routers/       Rutas de la API, una por módulo (auth, catálogo, préstamos...)
│   └── services/      Reglas de negocio del laboratorio
├── scripts/           Utilidades (crear el primer encargado, etc.)
├── uploads/           Fotos y manuales de los equipos
├── .env.example       Plantilla de configuración
└── requirements.txt   Librerías necesarias
```

## Primera vez (Windows, Símbolo del sistema)

```
py -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
notepad .env
```

## Cada vez que trabajes

```
.venv\Scripts\activate
uvicorn app.main:app --reload
```

- Prueba de conexión: http://127.0.0.1:8000/api/salud
- Documentación interactiva: http://127.0.0.1:8000/docs

## Crear el primer encargado

```
python -m scripts.crear_encargado
```

## Módulo 1 · Autenticación (`/api/auth`)

| Método | Ruta | Qué hace | SRS |
|---|---|---|---|
| POST | `/api/auth/registro` | Registro de estudiante | 2 |
| POST | `/api/auth/login` | Login (boleta o correo) + bloqueo 5 intentos / 15 min | 1, 1.1, 1.2 |
| GET | `/api/auth/yo` | Datos del usuario con sesión | 1.1 |
| PUT | `/api/auth/contrasena` | Cambio voluntario de contraseña | 1.4 |
| POST | `/api/auth/restablecer/verificar` | Restablecimiento, paso 1: verificar correo | 1.3 |
| POST | `/api/auth/restablecer` | Restablecimiento, paso 2: nueva contraseña | 1.3 |

Las rutas protegidas necesitan el encabezado `Authorization: Bearer <token>`.
En `/docs`, usa el botón **Authorize** y pega el `access_token` del login.

## Módulo 2 · Catálogo e inventario

**Catálogo (cualquier usuario con sesión)**

| Método | Ruta | Qué hace | SRS |
|---|---|---|---|
| GET | `/api/catalogo` | Equipos con disponibilidad actual, búsqueda y filtros | 4, 4.1 |
| GET | `/api/catalogo/{codigo}` | Ficha completa del equipo | 4 |
| GET | `/api/categorias` | Categorías con total y disponibles | 4 |

**Encargado**

| Método | Ruta | Qué hace | SRS |
|---|---|---|---|
| GET | `/api/inventario/equipos` | Tabla paginada (20 por página) | 8.8 |
| POST | `/api/inventario/equipos` | Alta (código automático) | 8.10, 8.11 |
| PUT | `/api/inventario/equipos/{codigo}` | Edición (sin cambiar código) | 8.10 |
| PATCH | `/api/inventario/equipos/{codigo}/estado` | Disponible ↔ En mantenimiento | — |
| POST | `/api/inventario/equipos/{codigo}/baja` | Baja con motivo (conserva historial) | 8.10 |
| DELETE | `/api/inventario/equipos/{codigo}` | Eliminar (solo si nunca se prestó) | 8.12 |
| PUT | `/api/inventario/equipos/{codigo}/foto` | Foto JPG/PNG/WebP ≤ 5 MB | 8.8 |
| PUT | `/api/inventario/equipos/{codigo}/manual` | Manual PDF ≤ 10 MB | 8.8 |
| POST/PUT/DELETE | `/api/categorias[/{id}]` | Crear, renombrar, eliminar categoría | 8.12 |

## Módulo 3 · Solicitudes y dictamen

> Requiere ejecutar `03_actualizacion_prestamos.sql` y `04_horario_devolucion.sql` una vez, y `pip install -r requirements.txt` (agrega `tzdata`).
>
> Horario: retiro de 07:00 a 20:30 (`horario_apertura` / `horario_cierre`); devolución hasta las 22:00 (`hora_limite_devolucion`), también para la prórroga.

**Estudiante**

| Método | Ruta | Qué hace | SRS |
|---|---|---|---|
| GET | `/api/estudiante/panel` | Préstamos activos, pendientes y alertas | 3 |
| POST | `/api/solicitudes/verificar` | Revisa carrito y horario sin guardar | 5, 6 |
| POST | `/api/solicitudes` | Envía la solicitud (queda Pendiente) | 6, 6.1, 6.2 |
| GET | `/api/solicitudes` | En curso, en revisión y finalizadas | 3.1 |
| GET | `/api/solicitudes/{folio}` | Detalle, línea de tiempo y PIN | 7, 7.1 |
| POST | `/api/solicitudes/{folio}/cancelar` | Cancelación (revoca PIN) | 6.2 |
| POST | `/api/solicitudes/{folio}/prorroga` | Extensión única de 1 hora | 6.3 |
| GET | `/api/solicitudes/{folio}/comprobante` | Datos del comprobante | 7.3 |
| GET/PATCH/POST | `/api/notificaciones...` | Avisos leído / no leído | 3.3, 3.4 |

**Encargado**

| Método | Ruta | Qué hace | SRS |
|---|---|---|---|
| GET | `/api/encargado/solicitudes/pendientes` | Pendientes por hora de retiro | 8.1 |
| GET | `/api/encargado/solicitudes/motivos-rechazo` | Checklist de motivos | 8.2 |
| POST | `/api/encargado/solicitudes/{folio}/aprobar` | Aprueba y genera PIN | 8.2, 7.1 |
| POST | `/api/encargado/solicitudes/{folio}/rechazar` | Rechaza con motivo | 8.2 |
| POST | `/api/sistema/tareas` | Ejecuta ya las tareas automáticas | — |

**Tareas automáticas (cada minuto):** pendientes sin revisar → Cancelada; aprobadas no recogidas
en la tolerancia → Cancelada + sanción de 2 días (sin sanción si algún equipo no estaba disponible
en el laboratorio, por ejemplo porque otro alumno no lo devolvió); entregadas pasadas de hora → Vencida;
recordatorio 15 min antes de devolver; sanciones cumplidas → Cumplida.

**Tolerancias:** el retiro tiene 30 minutos de tolerancia; la devolución **no tiene tolerancia**.
El recordatorio 15 minutos antes lo avisa: "Te quedan 15 minutos. Después de las HH:MM se aplica
sanción por retraso".

## Módulo 4 · Ventanilla, incidencias y sanciones

**Encargado**

| Método | Ruta | Qué hace | SRS |
|---|---|---|---|
| GET | `/api/encargado/panel` | Contadores y categorías con bajo stock | 8 |
| GET | `/api/ventanilla/entregas?buscar=` | Aprobadas por entregar (boleta o código) + verificaciones | 8.3, 8.4 |
| POST | `/api/ventanilla/entregas/{folio}/verificar-equipo` | ¿El código escaneado pertenece al préstamo? | 8.5 |
| POST | `/api/ventanilla/entregas/{folio}` | Checklist + PIN (3 intentos → bloqueo 15 min) | 8.5 |
| GET | `/api/ventanilla/devoluciones?buscar=` | Entregadas o vencidas, con minutos de retraso | 8.6 |
| POST | `/api/ventanilla/devoluciones/{folio}` | Inspección, incidencias, sanciones y cierre | 8.6 – 8.8 |
| POST | `/api/ventanilla/devoluciones/{folio}/equipos/{codigo}/resolver` | Resuelve un equipo pendiente; sin pendientes → Devuelta | 8.8 |
| GET | `/api/ventanilla/prestamos/{folio}` | Detalle de cualquier préstamo (sin PIN) | 7 |
| GET | `/api/encargado/incidencias` | Incidencias por folio, boleta o código | 8.7 |
| GET/POST | `/api/encargado/sanciones` | Consultar / aplicar sanción manual | 8.9 |
| POST | `/api/encargado/sanciones/{id}/retirar` | Retirar sanción (Condonada) | 8.9 |

**Estudiante:** `GET /api/estudiante/historial` → incidencias y sanciones (SRS 3.2).

> Requiere ejecutar `05_equipos_devueltos.sql` una vez.

Reglas:
- **Dañado** → incidencia de **Daño** (equipo a mantenimiento, sanción de 15 días).
- **Incompleto** → el encargado elige **Daño** o **Pérdida**. Pérdida (también para un equipo no devuelto)
  → baja automática del equipo y sanción indefinida.
- Devolver después de la hora límite registra solo una incidencia de **Retraso** (7 días).
- El préstamo pasa a **Devuelta** solo si todos los equipos quedan en **Bueno**. Si no, queda **abierto**
  (cuenta como adeudo del alumno) hasta resolver cada equipo pendiente con la ruta `.../resolver`.
  Resolver no retira la sanción ni cambia el estado del equipo: eso se hace en sanciones e inventario.
