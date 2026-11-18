-- =====================================================================
--  Script 06: Correo de estudiante de cualquier dominio
--  Ejecutar UNA vez sobre la base existente (se puede repetir sin error).
--  (Si creas la base desde cero con el 01 actualizado, ya no hace falta.)
--
--  Antes solo se aceptaban @gmail.com, @alumno.ipn.mx e @ipn.mx.
--  Ahora se acepta cualquier correo con formato válido (registro normal,
--  registro manual del encargado y restablecimiento de contraseña).
-- =====================================================================

ALTER TABLE estudiante DROP CONSTRAINT IF EXISTS estudiante_correo_check;

ALTER TABLE estudiante
    ADD CONSTRAINT estudiante_correo_check
    CHECK (correo ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');
