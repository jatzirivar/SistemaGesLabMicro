# Publicar el sistema en internet (gratis)

Con esto el sistema abre desde cualquier celular, tableta o computadora, con cualquier red
(Wi‑Fi o datos), en una dirección como `https://sgpl-esime.onrender.com`.

| Pieza | Dónde queda | Costo |
|---|---|---|
| Página (React) y servidor (FastAPI) | **Render**: un solo servicio web | Gratis |
| Base de datos PostgreSQL | **Neon** | Gratis, no caduca (1 GB) |
| Fotos y manuales | Dentro de la base de datos (tabla `archivo`) | Incluido |

> Tu PC sigue funcionando igual que antes (`uvicorn` + `npm run dev`, fotos en `uploads/`).
> La versión en internet tiene **su propia base de datos**: lo que registres en tu PC no aparece en
> línea y al revés.

---

## 0. Antes de empezar

1. Copia a tu proyecto:
   - `servidor.zip` → reemplaza la carpeta `servidor` (versión **0.7.0**).
   - `08_archivos.sql` → en la carpeta `Base de Datos`.
   - `render.yaml` → en la **carpeta principal** del proyecto (junto a `servidor` y `frontend`).
2. Revisa que en GitHub esté el archivo `frontend/package-lock.json` (Render lo usa para instalar).
3. Sube todo a GitHub:
   ```powershell
   git add .
   git commit -m "Preparar publicación en Render y Neon"
   git push
   ```

## 1. Crear la base de datos en Neon

1. Entra a **https://neon.com** → *Sign up* (puedes entrar con tu cuenta de GitHub).
2. Crea un proyecto:
   - **Nombre:** `sgpl-esime`
   - **Versión de Postgres:** la que proponga (16 o 17 sirven).
   - **Región:** *AWS US East 2 (Ohio)* (la misma región que usaremos en Render).
3. En el panel del proyecto presiona **Connect**:
   - **Desactiva** la opción *Connection pooling* (el servidor necesita la conexión directa para la zona horaria).
   - Copia la cadena de conexión. Se ve así:
     `postgresql://neondb_owner:CLAVE@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - **Guárdala en un lugar seguro: es la contraseña de tu base de datos. No la subas a GitHub.**

## 2. Crear las tablas en Neon

En Neon abre **SQL Editor**. Abre cada script con el Bloc de notas, copia **todo** su contenido,
pégalo en el editor y presiona **Run**. Uno por uno y en este orden:

| Orden | Script | ¿Obligatorio? |
|---|---|---|
| 1 | `01_esquema.sql` | Sí (ya incluye los cambios de 03 a 06) |
| 2 | `02_datos_prueba.sql` | Opcional: categorías y equipos de prueba |
| 3 | `07_dias_inhabiles_2026_2027.sql` | Sí |
| 4 | `08_archivos.sql` | Sí |

**No** ejecutes 03, 04, 05 ni 06: el 01 ya los trae.

## 3. Crear la cuenta del encargado en Neon (desde tu PC)

En PowerShell, dentro de `servidor` y con el entorno virtual activado:

```powershell
$env:DATABASE_URL = "postgresql://neondb_owner:CLAVE@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
python -m scripts.crear_encargado
Remove-Item Env:DATABASE_URL
```

La última línea hace que tu servidor local vuelva a usar tu base de datos de siempre.

## 4. Publicar en Render

1. Entra a **https://render.com** → *Get Started* → entra con tu cuenta de **GitHub**.
2. Autoriza a Render a ver el repositorio `SistemaGesLabMicro` (aunque sea privado).
3. Presiona **New +** → **Blueprint** → elige el repositorio.
   Render lee el archivo `render.yaml` y muestra el servicio `sgpl-esime`.
4. Te pedirá el valor de **DATABASE_URL**: pega la cadena de Neon del paso 1.
5. Presiona **Apply** / **Deploy Blueprint** y espera (~5 a 10 minutos la primera vez).
   En *Logs* verás que compila la página (`npm run build`) y luego instala Python.
6. Cuando diga **Live**, arriba aparece tu dirección, por ejemplo
   `https://sgpl-esime.onrender.com` (si el nombre ya estaba ocupado, Render le agrega letras).

## 5. Probar

1. Abre `https://TU-DIRECCION.onrender.com/api/salud`: debe decir `"base_de_datos": "conectada"`.
2. Abre `https://TU-DIRECCION.onrender.com` → inicia sesión con el encargado del paso 3.
3. Sube las fotos: menú ☰ → **Gestión de Inventario** → **Gestionar** → **Subir foto**.
4. Registra un alumno desde **Registrar acceso** y haz un préstamo de prueba.
5. Ábrelo desde tu celular **con datos móviles** para confirmar que funciona fuera de tu red.

## 6. Cuando cambies el código

Cada `git push` hace que Render vuelva a publicar solo (tarda unos minutos).
Si cambias la base de datos con un script nuevo, ejecútalo también en el SQL Editor de Neon.

---

## Limitaciones del plan gratuito (importante para la presentación)

- **Se duerme:** después de **15 minutos sin visitas** el servidor se apaga. La siguiente visita
  tarda **alrededor de 1 minuto** en abrir. **Antes de presentar, abre la página 2 o 3 minutos antes.**
- **Tareas automáticas:** las que corren cada minuto (cancelar por no retiro, marcar vencidos,
  recordatorio de 15 minutos, cumplir sanciones) solo corren mientras el servidor está despierto.
  Al despertar se ponen al día, pero un recordatorio de 15 minutos puede no enviarse si el servidor
  estaba dormido en ese momento.
- **Espacio:** Neon da 1 GB. Las fotos y manuales cuentan dentro de ese espacio: usa fotos ligeras
  (menos de 500 KB es ideal).
- **Horas de cómputo de Neon:** 100 al mes. Como la base de datos también se apaga cuando nadie la usa,
  para una presentación y pruebas alcanza de sobra.

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| El *deploy* falla en `npm` | Que `frontend/package-lock.json` y `frontend/package.json` estén en GitHub |
| `/api/salud` da error de conexión | La cadena `DATABASE_URL` en Render → *Environment* (sin espacios y con `?sslmode=require`) |
| Error de zona horaria o `options` | Que la cadena sea **sin** *Connection pooling* (el host no debe decir `-pooler`) |
| Página en blanco | En Render → *Logs*, que `npm run build` haya terminado sin errores |
| No puedo iniciar sesión | Que hayas creado el encargado **en Neon** (paso 3), no solo en tu PC |
