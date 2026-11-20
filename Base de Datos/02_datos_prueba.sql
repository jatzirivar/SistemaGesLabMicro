-- =====================================================================
--  Script 02: Datos de prueba (OPCIONAL, solo para desarrollo)
--  Ejecutar después de 01_esquema.sql
--  Los usuarios de prueba se crean desde el backend (necesitan hash bcrypt).
-- =====================================================================

INSERT INTO categoria (nombre, prefijo) VALUES
    ('Osciloscopios',          'OSC'),
    ('Fuentes de alimentación', 'FUEN'),
    ('Generadores de funciones', 'GEN'),
    ('Multímetros',            'MULT'),
    ('Microcontroladores',     'MIC');

-- El código (OSC-001, OSC-002, ...) se genera solo
INSERT INTO equipo (id_categoria, nombre, descripcion, especificaciones, componentes_incluidos, fecha_adquisicion)
SELECT c.id_categoria, v.nombre, v.descripcion, v.especificaciones, v.componentes, v.fecha::DATE
  FROM (VALUES
    ('OSC',  'Osciloscopio Rigol DS1054Z',      'Osciloscopio digital de 4 canales', '50 MHz, 1 GSa/s',        '2 puntas, cable de corriente', '2023-02-10'),
    ('OSC',  'Osciloscopio Rigol DS1054Z',      'Osciloscopio digital de 4 canales', '50 MHz, 1 GSa/s',        '2 puntas, cable de corriente', '2023-02-10'),
    ('OSC',  'Osciloscopio Tektronix TBS1052C', 'Osciloscopio digital de 2 canales', '50 MHz, 1 GSa/s',        '2 puntas, cable de corriente', '2024-08-01'),
    ('FUEN', 'Fuente GW Instek GPS-3303',       'Fuente de alimentación triple',     '0-30 V, 0-3 A',          'Cables banana-caimán',         '2022-05-20'),
    ('FUEN', 'Fuente GW Instek GPS-3303',       'Fuente de alimentación triple',     '0-30 V, 0-3 A',          'Cables banana-caimán',         '2022-05-20'),
    ('GEN',  'Generador Siglent SDG1032X',      'Generador de funciones arbitrarias','30 MHz, 2 canales',      'Cable BNC',                    '2023-09-15'),
    ('MULT', 'Multímetro Fluke 115',            'Multímetro digital de campo',       'True RMS, 600 V',        '2 puntas',                     '2021-01-12'),
    ('MIC',  'Kit PIC18F4550',                  'Tarjeta de desarrollo PIC',         '48 MHz, USB 2.0',        'Tarjeta, cable USB, programador', '2024-01-30')
  ) AS v(prefijo, nombre, descripcion, especificaciones, componentes, fecha)
  JOIN categoria c ON c.prefijo = v.prefijo;

INSERT INTO dia_inhabil (fecha_inhabil, descripcion) VALUES
    ('2026-11-16', 'Aniversario de la Revolución Mexicana (puente)'),
    ('2026-12-25', 'Navidad');
