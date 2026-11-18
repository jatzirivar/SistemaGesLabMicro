-- =====================================================================
--  Script 04: Horario de retiro y hora límite de devolución
--  Ejecutar UNA vez sobre la base existente (se puede repetir sin error).
--  (Si creas la base desde cero con el 01 actualizado, ya no hace falta.)
--
--  horario_apertura / horario_cierre -> ventana para RETIRAR el equipo (07:00 a 20:30)
--  hora_limite_devolucion            -> última hora para DEVOLVER (22:00, fin de la última clase)
-- =====================================================================

ALTER TABLE configuracion_lab
    ADD COLUMN IF NOT EXISTS hora_limite_devolucion TIME NOT NULL DEFAULT '22:00';

UPDATE configuracion_lab
   SET horario_apertura       = '07:00',
       horario_cierre         = '20:30',
       hora_limite_devolucion = '22:00'
 WHERE id_configuracion = 1;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_config_devolucion') THEN
        ALTER TABLE configuracion_lab
            ADD CONSTRAINT ck_config_devolucion CHECK (horario_cierre <= hora_limite_devolucion);
    END IF;
END $$;

COMMENT ON COLUMN configuracion_lab.horario_apertura       IS 'Primera hora para retirar';
COMMENT ON COLUMN configuracion_lab.horario_cierre         IS 'Última hora para retirar';
COMMENT ON COLUMN configuracion_lab.hora_limite_devolucion IS 'Última hora para devolver, incluida la prórroga';
