-- =====================================================================
--  Script 07: Días inhábiles del Calendario Académico IPN 2026-2027
--  (Modalidad escolarizada). Ejecutar sobre la base existente; se puede repetir.
--
--  Solo se cargan los días de lunes a viernes, desde el 18/11/2026 hasta el
--  06/08/2027, marcados en el calendario como:
--    - Vacaciones
--    - Día de descanso obligatorio
--    - Día de descanso por acuerdo sindical
--  Los sábados y domingos ya están bloqueados por los días de servicio (lunes a viernes).
--  Las semanas sin clases que no son vacaciones (planeación, ETS, inscripciones)
--  y el Día del Politécnico NO se cargan: el laboratorio presta esos días.
--  Total: 39 días.
-- =====================================================================

INSERT INTO dia_inhabil (fecha_inhabil, descripcion) VALUES
    ('2026-12-21', 'Vacaciones de invierno'),
    ('2026-12-22', 'Vacaciones de invierno'),
    ('2026-12-23', 'Vacaciones de invierno'),
    ('2026-12-24', 'Vacaciones de invierno'),
    ('2026-12-25', 'Navidad (descanso obligatorio)'),
    ('2026-12-28', 'Vacaciones de invierno'),
    ('2026-12-29', 'Vacaciones de invierno'),
    ('2026-12-30', 'Vacaciones de invierno'),
    ('2026-12-31', 'Vacaciones de invierno'),
    ('2027-01-01', 'Año Nuevo (descanso obligatorio)'),
    ('2027-02-01', 'Día de la Constitución (descanso obligatorio)'),
    ('2027-03-15', 'Natalicio de Benito Juárez (descanso obligatorio)'),
    ('2027-03-22', 'Vacaciones de primavera'),
    ('2027-03-23', 'Vacaciones de primavera'),
    ('2027-03-24', 'Vacaciones de primavera'),
    ('2027-03-25', 'Vacaciones de primavera'),
    ('2027-03-26', 'Vacaciones de primavera'),
    ('2027-03-29', 'Vacaciones de primavera'),
    ('2027-03-30', 'Vacaciones de primavera'),
    ('2027-03-31', 'Vacaciones de primavera'),
    ('2027-04-01', 'Vacaciones de primavera'),
    ('2027-04-02', 'Vacaciones de primavera'),
    ('2027-05-05', 'Batalla de Puebla (descanso obligatorio)'),
    ('2027-05-10', 'Día de descanso por acuerdo sindical'),
    ('2027-07-19', 'Vacaciones de verano'),
    ('2027-07-20', 'Vacaciones de verano'),
    ('2027-07-21', 'Día de descanso obligatorio (calendario IPN)'),
    ('2027-07-22', 'Vacaciones de verano'),
    ('2027-07-23', 'Vacaciones de verano'),
    ('2027-07-26', 'Vacaciones de verano'),
    ('2027-07-27', 'Vacaciones de verano'),
    ('2027-07-28', 'Vacaciones de verano'),
    ('2027-07-29', 'Vacaciones de verano'),
    ('2027-07-30', 'Vacaciones de verano'),
    ('2027-08-02', 'Vacaciones de verano'),
    ('2027-08-03', 'Vacaciones de verano'),
    ('2027-08-04', 'Vacaciones de verano'),
    ('2027-08-05', 'Vacaciones de verano'),
    ('2027-08-06', 'Vacaciones de verano')
ON CONFLICT (fecha_inhabil) DO UPDATE SET descripcion = EXCLUDED.descripcion;
