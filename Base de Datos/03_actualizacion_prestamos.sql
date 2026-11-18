-- =====================================================================
--  Script 03: Actualización para el módulo de solicitudes y préstamos
--  Ejecutar UNA vez sobre la base que ya tiene 01_esquema.sql.
--  (Si creas la base desde cero con el 01 actualizado, ya no hace falta.)
-- =====================================================================

-- Para mostrar en la línea de tiempo cuándo y por qué se canceló (SRS 7)
ALTER TABLE prestamo ADD COLUMN IF NOT EXISTS fecha_hora_cancelacion TIMESTAMPTZ;
ALTER TABLE prestamo ADD COLUMN IF NOT EXISTS motivo_cancelacion     VARCHAR(255);

-- Acelera la búsqueda de notificaciones ya enviadas (recordatorios)
CREATE INDEX IF NOT EXISTS ix_notificacion_folio ON notificacion (folio_prestamo);
