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
