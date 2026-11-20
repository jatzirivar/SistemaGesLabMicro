-- =====================================================================
--  Sistema de Gestión de Préstamos del Laboratorio de Microprocesadores
--  ESIME CU - Equipo 2
--  Script 08: Tabla archivo (fotos y manuales dentro de la base de datos)
--
--  Se usa en la versión publicada en internet (ALMACEN_ARCHIVOS=bd), porque el
--  hosting gratuito borra su disco cada vez que el servidor se reinicia.
--  En tu PC (ALMACEN_ARCHIVOS=disco) la tabla puede existir vacía sin problema.
--
--  La columna equipo.fotografia / equipo.manual sigue guardando la ruta
--  (ej. 'equipos/OSC-001_a1b2c3d4.jpg'); esta tabla guarda el contenido.
--  Se puede ejecutar más de una vez.
-- =====================================================================

CREATE TABLE IF NOT EXISTS archivo (
    ruta              VARCHAR(255)  PRIMARY KEY,
    tipo_mime         VARCHAR(50)   NOT NULL
                      CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
    contenido         BYTEA         NOT NULL,
    fecha_hora_carga  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE archivo IS 'Fotos y manuales de equipos cuando el servidor no tiene disco permanente';
