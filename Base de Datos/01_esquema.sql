-- Zona horaria de la base de datos (todas las fechas en hora del centro de México)
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone = %L',
                   current_database(), 'America/Mexico_City');
END $$;
SET TIME ZONE 'America/Mexico_City';

-- =====================================================================
-- 1. TABLAS CATÁLOGO
--    Los ID se insertan con valor fijo porque el backend y algunas
--    reglas de este script los usan directamente. NO cambiarlos.
-- =====================================================================
-- 1. Catálogo de Estados de Cuenta de Usuario
CREATE TABLE estado_cuenta (
    id_estado_cuenta    SMALLINT     PRIMARY KEY,
    estado              VARCHAR(20)  NOT NULL UNIQUE
);
-- 2. Catálogo de Estados Operativos del Hardware
CREATE TABLE estado_equipo (
    id_estado_equipo    SMALLINT     PRIMARY KEY,
    estado              VARCHAR(20)  NOT NULL UNIQUE
);
-- 3. Catálogo de Estados del Trámite de Préstamo
CREATE TABLE estado_prestamo (
    id_estado_prestamo  SMALLINT     PRIMARY KEY,
    estado              VARCHAR(20)  NOT NULL UNIQUE
);
-- 4. Catálogo de Dictamen de Inspección Física
CREATE TABLE inspeccion_fisica (
    id_inspeccion       SMALLINT     PRIMARY KEY,
    estado              VARCHAR(20)  NOT NULL UNIQUE
);
-- 5. Catálogo de Tipos de Incidencia
CREATE TABLE tipo_incidencia (
    id_tipo_incidencia  SMALLINT     PRIMARY KEY,
    tipo                VARCHAR(20)  NOT NULL UNIQUE,
    -- Días de sanción que genera este tipo. NULL = sanción indefinida.
    dias_sancion        SMALLINT     CHECK (dias_sancion IS NULL OR dias_sancion > 0)
);
-- 6. Catálogo de Estados de Sanciones
CREATE TABLE estado_sancion (
    id_estado_sancion   SMALLINT     PRIMARY KEY,
    estado              VARCHAR(20)  NOT NULL UNIQUE
);
-- 7. Catálogo de Estados de Notificaciones
CREATE TABLE estado_notificacion (
    id_estado_notificacion SMALLINT  PRIMARY KEY,
    estado              VARCHAR(20)  NOT NULL UNIQUE
);

-- Motivos estandarizados de rechazo (SRS 8.2)
CREATE TABLE motivo_rechazo (
    id_motivo_rechazo   SMALLINT     PRIMARY KEY,
    motivo              VARCHAR(40)  NOT NULL UNIQUE
);
--Inserta datos en las tablas 
INSERT INTO estado_cuenta VALUES
    (1, 'Activa'),
    (2, 'Suspendida'),   -- bloqueo manual por adeudos (SRS 8.13)
    (3, 'Bloqueada');    -- bloqueo temporal por 5 intentos fallidos (15 min)

INSERT INTO estado_equipo VALUES
    (1, 'Disponible'),
    (2, 'Prestado'),
    (3, 'En mantenimiento'),
    (4, 'No disponible');

INSERT INTO estado_prestamo VALUES
    (1, 'Pendiente'),
    (2, 'Aprobada'),
    (3, 'Entregada'),
    (4, 'Vencida'),
    (5, 'Devuelta'),
    (6, 'Rechazada'),
    (7, 'Cancelada');

INSERT INTO inspeccion_fisica VALUES
    (1, 'Bueno'),
    (2, 'Dañado'),
    (3, 'Incompleto');

INSERT INTO tipo_incidencia VALUES
    (1, 'Retraso',    7),
    (2, 'Daño',       15),
    (3, 'Pérdida',    NULL),   -- indefinida
    (4, 'No retiro',  2);      -- aprobado y no recogido dentro de la tolerancia

INSERT INTO estado_sancion VALUES
    (1, 'Vigente'),
    (2, 'Cumplida'),
    (3, 'Condonada');

INSERT INTO estado_notificacion VALUES
    (1, 'No leída'),
    (2, 'Leída');

INSERT INTO motivo_rechazo VALUES
    (1, 'Equipo no disponible'),
    (2, 'Sanción vigente'),
    (3, 'Adeudo de equipos anteriores'),
    (4, 'Datos incoherentes'),
    (5, 'Otro');

-- =====================================================================
-- 2. USUARIOS
-- =====================================================================

CREATE TABLE estudiante (
    id_estudiante       INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    boleta              CHAR(10)     NOT NULL UNIQUE
                                     CHECK (boleta ~ '^[0-9]{10}$'),
    nombre              VARCHAR(60)  NOT NULL,
    apellido_pat        VARCHAR(60)  NOT NULL,
    apellido_mat        VARCHAR(60),
    correo              VARCHAR(120) NOT NULL
                                     CHECK (correo ~* '^[A-Z0-9._%+-]+@(gmail\.com|alumno\.ipn\.mx|ipn\.mx)$'),
    contrasena_hash     VARCHAR(255) NOT NULL,   -- bcrypt, nunca texto plano (SRS 1.5)
    intentos_fallidos   SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    bloqueado_hasta     TIMESTAMPTZ,             -- fin del bloqueo de 15 min
    id_estado_cuenta    SMALLINT     NOT NULL DEFAULT 1
                                     REFERENCES estado_cuenta,
    fecha_registro      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_estudiante_correo ON estudiante (lower(correo));
CREATE INDEX ix_estudiante_nombre ON estudiante (lower(nombre || ' ' || apellido_pat || ' ' || coalesce(apellido_mat, '')));

CREATE TABLE encargado (
    id_encargado        INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              VARCHAR(60)  NOT NULL,
    apellido_pat        VARCHAR(60)  NOT NULL,
    apellido_mat        VARCHAR(60),
    correo              VARCHAR(120) NOT NULL
                                     CHECK (correo ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    contrasena_hash     VARCHAR(255) NOT NULL,
    intentos_fallidos   SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    bloqueado_hasta     TIMESTAMPTZ,
    id_estado_cuenta    SMALLINT     NOT NULL DEFAULT 1
                                     REFERENCES estado_cuenta,
    fecha_registro      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_encargado_correo ON encargado (lower(correo));

-- =====================================================================
-- 3. INVENTARIO
-- =====================================================================

CREATE TABLE categoria (
    id_categoria        INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              VARCHAR(60)  NOT NULL,
    prefijo             VARCHAR(4)   NOT NULL UNIQUE
                                     CHECK (prefijo ~ '^[A-Z]{3,4}$'),
    -- Último número usado. Nunca baja, así un código dado de baja no se reutiliza (SRS 8.11)
    ultimo_consecutivo  INTEGER      NOT NULL DEFAULT 0 CHECK (ultimo_consecutivo BETWEEN 0 AND 999)
);
CREATE UNIQUE INDEX ux_categoria_nombre ON categoria (lower(nombre));

CREATE TABLE equipo (
    codigo_inventario   VARCHAR(8)   PRIMARY KEY
                                     CHECK (codigo_inventario ~ '^[A-Z]{3,4}-[0-9]{3}$'),
    id_categoria        INTEGER      NOT NULL REFERENCES categoria ON DELETE RESTRICT,
    nombre              VARCHAR(100) NOT NULL,
    descripcion         TEXT         NOT NULL,
    especificaciones    TEXT         NOT NULL,
    componentes_incluidos TEXT       NOT NULL,   -- lista informativa (SRS 8.10)
    fotografia          VARCHAR(255),            -- ruta del archivo en /uploads
    manual              VARCHAR(255),            -- ruta del PDF del manual (SRS 8.8)
    fecha_adquisicion   DATE         NOT NULL,
    id_estado_equipo    SMALLINT     NOT NULL DEFAULT 1 REFERENCES estado_equipo,
    motivo_baja         VARCHAR(255),
    fecha_baja          DATE,
    CONSTRAINT ck_equipo_baja CHECK (
        (id_estado_equipo = 4 AND motivo_baja IS NOT NULL AND fecha_baja IS NOT NULL)
        OR (id_estado_equipo <> 4)
    )
);
CREATE INDEX ix_equipo_categoria ON equipo (id_categoria);
CREATE INDEX ix_equipo_nombre    ON equipo (lower(nombre));

-- Genera el siguiente código de inventario de una categoría (ej. OSC-001).
-- El UPDATE bloquea la fila de la categoría, así dos altas simultáneas
-- nunca obtienen el mismo número.
CREATE FUNCTION fn_siguiente_codigo(p_id_categoria INTEGER)
RETURNS VARCHAR AS $$
DECLARE
    v_prefijo VARCHAR(4);
    v_numero  INTEGER;
BEGIN
    UPDATE categoria
       SET ultimo_consecutivo = ultimo_consecutivo + 1
     WHERE id_categoria = p_id_categoria
    RETURNING prefijo, ultimo_consecutivo INTO v_prefijo, v_numero;

    IF v_prefijo IS NULL THEN
        RAISE EXCEPTION 'La categoría % no existe', p_id_categoria;
    END IF;
    RETURN v_prefijo || '-' || lpad(v_numero::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Al dar de alta un equipo sin código, se genera automáticamente.
CREATE FUNCTION tg_equipo_asignar_codigo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo_inventario IS NULL THEN
        NEW.codigo_inventario := fn_siguiente_codigo(NEW.id_categoria);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_equipo_asignar_codigo
    BEFORE INSERT ON equipo
    FOR EACH ROW EXECUTE FUNCTION tg_equipo_asignar_codigo();

-- La edición no permite cambiar el código ni la categoría (SRS 8.10).
CREATE FUNCTION tg_equipo_codigo_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo_inventario <> OLD.codigo_inventario THEN
        RAISE EXCEPTION 'El código de inventario no se puede modificar';
    END IF;
    IF NEW.id_categoria <> OLD.id_categoria THEN
        RAISE EXCEPTION 'La categoría de un equipo no se puede modificar (afecta su código)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_equipo_codigo_inmutable
    BEFORE UPDATE ON equipo
    FOR EACH ROW EXECUTE FUNCTION tg_equipo_codigo_inmutable();

-- =====================================================================
-- 4. CONFIGURACIÓN DEL LABORATORIO (una sola fila)
-- =====================================================================

CREATE TABLE configuracion_lab (
    id_configuracion    SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id_configuracion = 1),
    horario_apertura    TIME         NOT NULL DEFAULT '07:00',
    horario_cierre      TIME         NOT NULL DEFAULT '20:30',
    -- Días de servicio en formato ISO: 1 = lunes ... 7 = domingo
    dias_servicio       SMALLINT[]   NOT NULL DEFAULT '{1,2,3,4,5}',
    duracion_ordinaria  SMALLINT     NOT NULL DEFAULT 90  CHECK (duracion_ordinaria > 0), -- minutos (1 clase)
    duracion_prorroga   SMALLINT     NOT NULL DEFAULT 60  CHECK (duracion_prorroga  > 0), -- minutos
    duracion_maxima     SMALLINT     NOT NULL DEFAULT 240 CHECK (duracion_maxima   > 0), -- minutos, tope absoluto
    limite_equipos      SMALLINT     NOT NULL DEFAULT 5   CHECK (limite_equipos    > 0), -- simultáneos por alumno
    limite_por_modelo   SMALLINT     NOT NULL DEFAULT 2   CHECK (limite_por_modelo > 0), -- piezas con el mismo nombre
    tolerancia_retiro   SMALLINT     NOT NULL DEFAULT 30  CHECK (tolerancia_retiro >= 0), -- minutos
    CONSTRAINT ck_config_horario  CHECK (horario_apertura < horario_cierre),
    CONSTRAINT ck_config_duracion CHECK (duracion_ordinaria <= duracion_maxima)
);
INSERT INTO configuracion_lab DEFAULT VALUES;

CREATE TABLE dia_inhabil (
    fecha_inhabil       DATE         PRIMARY KEY,
    descripcion         VARCHAR(100) NOT NULL
);

-- =====================================================================
-- 5. PRÉSTAMOS
-- =====================================================================

-- Folio único e irrepetible: PRE-2026-000001
CREATE SEQUENCE seq_folio_prestamo;

CREATE TABLE prestamo (
    folio                   VARCHAR(16)  PRIMARY KEY
                                         DEFAULT 'PRE-' || to_char(now(), 'YYYY') || '-'
                                                 || lpad(nextval('seq_folio_prestamo')::TEXT, 6, '0'),
    id_estudiante           INTEGER      NOT NULL REFERENCES estudiante ON DELETE RESTRICT,
    grupo                   VARCHAR(6)   NOT NULL CHECK (length(trim(grupo)) > 0),
    id_estado_prestamo      SMALLINT     NOT NULL DEFAULT 1 REFERENCES estado_prestamo,
    aceptacion_reglamento   BOOLEAN      NOT NULL CHECK (aceptacion_reglamento),
    fecha_hora_solicitud    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Programado. La hora límite de devolución NO se guarda: se calcula
    -- (retiro + duración ordinaria + prórroga, con tope de 4 h). Ver vista_prestamo.
    fecha_hora_prog_retiro  TIMESTAMPTZ  NOT NULL,
    prorroga                BOOLEAN      NOT NULL DEFAULT FALSE,

    -- Dictamen
    id_encargado_dictamen   INTEGER      REFERENCES encargado,
    fecha_hora_dictamen     TIMESTAMPTZ,
    id_motivo_rechazo       SMALLINT     REFERENCES motivo_rechazo,
    detalle_rechazo         VARCHAR(255),

    -- PIN de entrega (SRS 7.1 y 8.5)
    codigo_pin              CHAR(4)      CHECK (codigo_pin ~ '^[0-9]{4}$'),
    intentos_pin            SMALLINT     NOT NULL DEFAULT 0 CHECK (intentos_pin >= 0),
    pin_bloqueado_hasta     TIMESTAMPTZ,

    -- Entrega real en ventanilla
    id_encargado_entrega    INTEGER      REFERENCES encargado,
    fecha_hora_real_entrega TIMESTAMPTZ,

    -- Devolución real
    id_encargado_devolucion   INTEGER    REFERENCES encargado,
    fecha_hora_real_devolucion TIMESTAMPTZ,

    -- Un rechazo siempre lleva motivo; "Otro" (5) además lleva texto
    CONSTRAINT ck_prestamo_rechazo CHECK (
        id_estado_prestamo <> 6 OR id_motivo_rechazo IS NOT NULL
    ),
    CONSTRAINT ck_prestamo_rechazo_otro CHECK (
        id_motivo_rechazo IS DISTINCT FROM 5 OR detalle_rechazo IS NOT NULL
    ),
    CONSTRAINT ck_prestamo_entrega_orden CHECK (
        fecha_hora_real_devolucion IS NULL
        OR (fecha_hora_real_entrega IS NOT NULL AND fecha_hora_real_devolucion >= fecha_hora_real_entrega)
    )
);
CREATE INDEX ix_prestamo_estudiante ON prestamo (id_estudiante);
CREATE INDEX ix_prestamo_estado     ON prestamo (id_estado_prestamo, fecha_hora_prog_retiro);

-- El PIN no se repite entre préstamos Aprobados (los únicos que lo usan)
CREATE UNIQUE INDEX ux_prestamo_pin_activo
    ON prestamo (codigo_pin)
    WHERE id_estado_prestamo = 2;

-- Cada equipo físico dentro de un préstamo. Cantidad siempre 1 (pieza específica).
CREATE TABLE detalle_prestamo (
    folio_prestamo          VARCHAR(16)  NOT NULL REFERENCES prestamo ON DELETE CASCADE,
    codigo_inventario       VARCHAR(8)   NOT NULL REFERENCES equipo   ON DELETE RESTRICT,
    -- Checklist de salida (SRS 8.5): una sola casilla "Se entrega completo"
    entregado_completo      BOOLEAN,
    obs_entrega             VARCHAR(255),
    -- Inspección de retorno (SRS 8.6): Bueno / Dañado / Incompleto
    id_inspec_devolucion    SMALLINT     REFERENCES inspeccion_fisica,
    obs_devolucion          VARCHAR(255),
    PRIMARY KEY (folio_prestamo, codigo_inventario)
);
CREATE INDEX ix_detalle_equipo ON detalle_prestamo (codigo_inventario);

-- =====================================================================
-- 6. INCIDENCIAS Y SANCIONES
-- =====================================================================

CREATE TABLE incidencia (
    id_incidencia       INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio_prestamo      VARCHAR(16)  NOT NULL REFERENCES prestamo ON DELETE RESTRICT,
    codigo_inventario   VARCHAR(8)   REFERENCES equipo,   -- NULL si afecta a todo el préstamo (retraso, no retiro)
    id_tipo_incidencia  SMALLINT     NOT NULL REFERENCES tipo_incidencia,
    id_encargado        INTEGER      REFERENCES encargado, -- NULL si la generó el sistema
    descripcion         VARCHAR(255) NOT NULL CHECK (length(trim(descripcion)) >= 5),
    resolucion          VARCHAR(255) NOT NULL CHECK (length(trim(resolucion))  >= 5),
    fecha_hora_registro TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- El equipo debe pertenecer al préstamo
    FOREIGN KEY (folio_prestamo, codigo_inventario)
        REFERENCES detalle_prestamo (folio_prestamo, codigo_inventario)
);
CREATE INDEX ix_incidencia_folio ON incidencia (folio_prestamo);

CREATE TABLE sancion (
    id_sancion          INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_estudiante       INTEGER      NOT NULL REFERENCES estudiante ON DELETE RESTRICT,
    id_incidencia       INTEGER      REFERENCES incidencia,  -- NULL si es manual
    id_encargado        INTEGER      REFERENCES encargado,   -- quién la aplicó (NULL = automática)
    motivo              VARCHAR(255) NOT NULL,
    fecha_inicio        DATE         NOT NULL DEFAULT current_date,
    fecha_fin           DATE,        -- último día de sanción. NULL = indefinida (pérdida)
    id_estado_sancion   SMALLINT     NOT NULL DEFAULT 1 REFERENCES estado_sancion,
    motivo_condonacion  VARCHAR(255),
    CONSTRAINT ck_sancion_fechas     CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT ck_sancion_condonada  CHECK (id_estado_sancion <> 3 OR motivo_condonacion IS NOT NULL)
);
CREATE INDEX ix_sancion_estudiante ON sancion (id_estudiante, id_estado_sancion);

-- =====================================================================
-- 7. NOTIFICACIONES
-- =====================================================================

CREATE TABLE notificacion (
    id_notificacion         INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_estudiante           INTEGER      NOT NULL REFERENCES estudiante ON DELETE CASCADE,
    folio_prestamo          VARCHAR(16)  REFERENCES prestamo ON DELETE SET NULL,
    titulo                  VARCHAR(100) NOT NULL,
    mensaje                 VARCHAR(500) NOT NULL,
    fecha_hora_generacion   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    id_estado_notificacion  SMALLINT     NOT NULL DEFAULT 1 REFERENCES estado_notificacion
);
CREATE INDEX ix_notificacion_estudiante ON notificacion (id_estudiante, id_estado_notificacion);

-- =====================================================================
-- 8. FUNCIONES Y VISTAS DE APOYO
-- =====================================================================

-- Hora límite de devolución = retiro + 90 min (+ 60 min si hay prórroga),
-- nunca más de 4 h después del retiro.
CREATE FUNCTION fn_limite_devolucion(p_retiro TIMESTAMPTZ, p_prorroga BOOLEAN)
RETURNS TIMESTAMPTZ AS $$
    SELECT LEAST(
        p_retiro + make_interval(mins => c.duracion_ordinaria
                                        + CASE WHEN p_prorroga THEN c.duracion_prorroga ELSE 0 END),
        p_retiro + make_interval(mins => c.duracion_maxima)
    )
    FROM configuracion_lab c
    WHERE c.id_configuracion = 1;
$$ LANGUAGE sql STABLE;

-- ¿El equipo está ocupado en ese horario? (pregunta 2: disponibilidad por horario)
-- Ocupan horario los préstamos Pendiente, Aprobada y Entregada.
-- Un préstamo Vencida ocupa el equipo sin importar la hora (no se ha devuelto).
CREATE FUNCTION fn_equipo_ocupado(
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
           AND (
                 p.id_estado_prestamo = 4
              OR (p.id_estado_prestamo IN (1, 2, 3)
                  AND tstzrange(p.fecha_hora_prog_retiro,
                                fn_limite_devolucion(p.fecha_hora_prog_retiro, p.prorroga))
                      && tstzrange(p_inicio, p_fin))
           )
    );
$$ LANGUAGE sql STABLE;

-- Préstamo con su hora límite calculada y datos para listados
CREATE VIEW vista_prestamo AS
SELECT p.*,
       fn_limite_devolucion(p.fecha_hora_prog_retiro, p.prorroga) AS fecha_hora_limite_devolucion,
       ep.estado     AS estado_prestamo,
       e.boleta,
       e.nombre || ' ' || e.apellido_pat || coalesce(' ' || e.apellido_mat, '') AS nombre_estudiante,
       (SELECT count(*) FROM detalle_prestamo d WHERE d.folio_prestamo = p.folio) AS total_equipos
  FROM prestamo p
  JOIN estado_prestamo ep ON ep.id_estado_prestamo = p.id_estado_prestamo
  JOIN estudiante e       ON e.id_estudiante       = p.id_estudiante;

-- ¿El estudiante tiene una sanción vigente hoy?
CREATE FUNCTION fn_tiene_sancion_vigente(p_id_estudiante INTEGER)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM sancion
         WHERE id_estudiante = p_id_estudiante
           AND id_estado_sancion = 1
           AND (fecha_fin IS NULL OR fecha_fin >= current_date)
    );
$$ LANGUAGE sql STABLE;