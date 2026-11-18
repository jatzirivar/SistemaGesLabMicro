-- =====================================================================
--  Script 05: Equipos devueltos con préstamo abierto por incidencias
--  Ejecutar UNA vez sobre la base existente (se puede repetir sin error).
--  (Si creas la base desde cero con el 01 actualizado, ya no hace falta.)
--
--  Cuando un préstamo se devuelve con equipos dañados o incompletos, queda
--  abierto hasta resolverlos. Sus equipos ya regresaron al laboratorio, así que
--  no deben seguir "ocupados": su disponibilidad la decide su estado
--  (Disponible, En mantenimiento, Dado de baja).
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_equipo_ocupado(
    p_codigo         VARCHAR,
    p_inicio         TIMESTAMPTZ,
    p_fin            TIMESTAMPTZ,
    p_excluir_folio  VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
          FROM detalle_prestamo d
          JOIN prestamo p ON p.folio = d.folio_prestamo
         WHERE d.codigo_inventario = p_codigo
           AND p.folio IS DISTINCT FROM p_excluir_folio
           AND p.fecha_hora_real_devolucion IS NULL   -- ya devuelto (aunque tenga pendientes): no ocupa
           AND (
                 p.id_estado_prestamo = 4
              OR (p.id_estado_prestamo IN (1, 2, 3)
                  AND tstzrange(p.fecha_hora_prog_retiro,
                                fn_limite_devolucion(p.fecha_hora_prog_retiro, p.prorroga))
                      && tstzrange(p_inicio, p_fin))
           )
    );
$$ LANGUAGE sql STABLE;
