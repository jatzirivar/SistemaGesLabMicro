# Sistema de Gestión de Préstamos del Laboratorio de Microprocesadores

Sistema web para solicitar, aprobar, entregar y devolver el equipo del Laboratorio de
Microprocesadores (osciloscopios, fuentes, generadores, multímetros, tarjetas de desarrollo).
Los estudiantes consultan el catálogo y envían solicitudes; el Encargado del Laboratorio
las dictamina, entrega el equipo en ventanilla con un PIN y registra la devolución.

**Horario:** el equipo se retira de lunes a viernes de 07:00 a 20:30 y se devuelve, como
máximo, a las 22:00. Cada préstamo dura 90 minutos (una clase), con una prórroga opcional
de 1 hora y un tope de 4 horas.

**ESIME CU · Equipo 2 · Grupo 6CV15**

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React + Tailwind CSS *(en desarrollo)* |
| Backend | Python 3.13 + FastAPI (API REST con JSON), reportes PDF con reportlab |
| Base de datos | PostgreSQL |
| Seguridad | Contraseñas con bcrypt, sesiones con JWT |

## Estructura del repositorio

```
SistemaGesLabMicro/
├── Base de Datos/      Scripts SQL de PostgreSQL
│   ├── 01_esquema.sql                 Tablas, catálogos, funciones y vistas (obligatorio)
│   ├── 02_datos_prueba.sql            Categorías y equipos de ejemplo (opcional)
│   ├── 03_actualizacion_prestamos.sql ┐
│   ├── 04_horario_devolucion.sql      │ Solo para bases creadas con una
│   ├── 05_equipos_devueltos.sql       │ versión anterior del 01
│   ├── 06_correo_cualquier_dominio.sql┘
│   └── 07_dias_inhabiles_2026_2027.sql  Días inhábiles del calendario IPN 2026-2027
├── Imágenes/           Diagramas y recursos del proyecto
└── backend/            Backend (API REST)
    ├── app/
    │   ├── core/       Configuración, conexión a BD, seguridad y errores
    │   ├── models/     Tablas de la BD como clases de Python (SQLAlchemy)
    │   ├── schemas/    Formato de los datos JSON (Pydantic)
    │   ├── routers/    Rutas de la API, una por módulo
    │   └── services/   Reglas de negocio del laboratorio
    ├── scripts/        Utilidades (crear el primer encargado)
    └── uploads/        Fotos y manuales de los equipos (no se suben a Git)
```

## Avance

| Módulo | Requisitos (SRS v6.0) | Estado |
|---|---|---|
| Autenticación y seguridad | 1 – 1.5, 2 | ✅ Terminado |
| Catálogo, inventario y categorías | 4, 4.1, 8.8, 8.10 – 8.12 | ✅ Terminado |
| Solicitudes, dictamen y notificaciones | 3 – 3.5, 5 – 7.3, 8.1, 8.2 | ✅ Terminado |
| Ventanilla: entrega, devolución, incidencias y sanciones | 8 – 8.9 | ✅ Terminado |
| Administración de alumnos, configuración y reportes PDF | 7.2, 8.13 – 8.15 | 🧪 En pruebas |
| Frontend | — | ⏳ Pendiente |

---

## Instalación (Windows)

### 1. Requisitos

- [Python 3.13](https://www.python.org/downloads/windows/). Al instalar, marca **"Add python.exe to PATH"**.
- [Git](https://git-scm.com/)
- [PostgreSQL](https://www.postgresql.org/download/windows/) con pgAdmin

### 2. Descargar el proyecto

```
git clone https://github.com/jatzirivar/SistemaGesLabMicro.git
cd SistemaGesLabMicro
```

### 3. Crear la base de datos

En pgAdmin:

1. Crea una base de datos llamada `gestion_prestamos`.
2. Abre el **Query Tool** y ejecuta, en orden:
   - `Base de Datos/01_esquema.sql`
   - `Base de Datos/02_datos_prueba.sql` *(opcional)*
   - `Base de Datos/07_dias_inhabiles_2026_2027.sql` (días festivos y vacaciones)

> Los scripts `03` a `06` **no** hacen falta en una base nueva: sus cambios ya vienen en el `01`.
> Son solo para quien creó su base con una versión anterior; se ejecutan en orden, una vez cada uno
> (se pueden repetir sin error). El `07` sí se ejecuta siempre: carga los días inhábiles.

### 4. Preparar el servidor

```
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
notepad .env
```

En el archivo `.env` escribe **tu** contraseña de PostgreSQL en `DB_CONTRASENA` y genera un
`JWT_SECRETO` con:

```
python -c "import secrets; print(secrets.token_hex(32))"
```

### 5. Crear el primer encargado

```
python -m scripts.crear_encargado
```

### 6. Arrancar el servidor

```
uvicorn app.main:app --reload
```

- Prueba de conexión: <http://127.0.0.1:8000/api/salud>
- Documentación interactiva de la API: <http://127.0.0.1:8000/docs>

Cada vez que vuelvas a trabajar, basta con:

```
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload
```

---

## Trabajo en equipo con Git

```
git pull                         ← siempre antes de empezar
(trabajas...)
git add .
git commit -m "Qué cambiaste"
git push
```

- Antes de cada commit revisa `git status`: **nunca** deben aparecer `.env` ni `.venv`.
- Eviten editar el mismo archivo al mismo tiempo; conviene repartirse los módulos.
- Cada integrante tiene **su propia base de datos local**: el código se comparte, los
  datos (usuarios, préstamos, fotos) no.

## Documentación

- Especificación de requisitos: SRS v6.0
- Documento de diseño: v5
- Detalle de las rutas de la API: [`backend/README.md`](backend/README.md)
