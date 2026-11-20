-- =====================================================================
--  Sistema de Gestión de Préstamos del Laboratorio de Microprocesadores
--  ESIME CU - Equipo 2
--  Script 09: Una solicitud Pendiente ya no aparta el equipo
--
--  Antes, una solicitud Pendiente (estado 1) ocupaba el horario y otro alumno
--  ya no podía pedir esa pieza. Ahora solo ocupan el horario las solicitudes
--  Aprobada (2) y Entregada (3), y las Vencida (4) en cualquier hora.
--  Varios alumnos pueden pedir la misma pieza; el encargado ve el choque al
--  aprobar y rechaza las demás con "Equipo no disponible".
--  Se puede ejecutar más de una vez.
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
              OR (p.id_estado_prestamo IN (2, 3)        -- Pendiente (1) ya no aparta
                  AND tstzrange(p.fecha_hora_prog_retiro,
                                fn_limite_devolucion(p.fecha_hora_prog_retiro, p.prorroga))
                      && tstzrange(p_inicio, p_fin))
           )
    );
$$ LANGUAGE sql STABLE;
