"""Valores fijos que coinciden con los catálogos insertados por 01_esquema.sql.

Si cambias un ID en la base de datos, cámbialo también aquí.
"""


class EstadoCuenta:
    ACTIVA = 1
    SUSPENDIDA = 2   # bloqueo manual por adeudos (SRS 8.13)
    BLOQUEADA = 3    # bloqueo temporal por intentos fallidos (SRS 1.1)


class EstadoEquipo:
    DISPONIBLE = 1
    PRESTADO = 2
    EN_MANTENIMIENTO = 3
    DADO_DE_BAJA = 4

    NOMBRES = {1: "Disponible", 2: "Prestado", 3: "En mantenimiento", 4: "Dado de baja"}


class EstadoPrestamo:
    PENDIENTE = 1
    APROBADA = 2
    ENTREGADA = 3
    VENCIDA = 4
    DEVUELTA = 5
    RECHAZADA = 6
    CANCELADA = 7

    # Préstamos que tienen al equipo apartado o fuera del laboratorio
    ACTIVOS = (1, 2, 3, 4)

    NOMBRES = {1: "Pendiente", 2: "Aprobada", 3: "Entregada", 4: "Vencida",
               5: "Devuelta", 6: "Rechazada", 7: "Cancelada"}

    # Agrupación de "Mis solicitudes" (SRS 3.1)
    EN_CURSO = (2, 3, 4)
    EN_REVISION = (1,)
    FINALIZADAS = (5, 6, 7)


class InspeccionFisica:
    BUENO = 1
    DANADO = 2
    INCOMPLETO = 3
    NOMBRES = {1: "Bueno", 2: "Dañado", 3: "Incompleto"}


class TipoIncidencia:
    RETRASO = 1
    DANO = 2
    PERDIDA = 3
    NO_RETIRO = 4
    NOMBRES = {1: "Retraso", 2: "Daño", 3: "Pérdida", 4: "No retiro"}


# Ventanilla (SRS 8.5)
INTENTOS_MAXIMOS_PIN = 3
MINUTOS_BLOQUEO_PIN = 15
MENSAJE_SIN_ENTREGAS = "No hay préstamos por entregar"      # SRS 8.3
MENSAJE_SIN_DEVOLUCIONES = "No hay préstamos por devolver"
MENSAJE_PIN_INCORRECTO = "PIN incorrecto"                   # SRS 8.5
BAJO_STOCK_MENOS_DE = 2                                     # SRS 8


class EstadoSancion:
    VIGENTE = 1
    CUMPLIDA = 2
    CONDONADA = 3


class EstadoNotificacion:
    NO_LEIDA = 1
    LEIDA = 2


class MotivoRechazo:
    OTRO = 5
    NOMBRES = {1: "Equipo no disponible", 2: "Sanción vigente", 3: "Adeudo de equipos anteriores",
               4: "Datos incoherentes", 5: "Otro"}


# Avisos (SRS 3.3 y 3.5)
MINUTOS_RECORDATORIO_DEVOLUCION = 15
MINUTOS_PROXIMO_A_VENCER = 30      # etiqueta amarilla "Próximo a vencer"
DIAS_SANCION_NO_RETIRO = 2
MENSAJE_AVISO_CANCELACION = ("La no cancelación a tiempo de equipos no requeridos "
                             "se considera motivo de sanción")


# Disponibilidad que ve el estudiante en el catálogo (SRS 4 y 4.1)
DISPONIBLE = "Disponible"
NO_DISPONIBLE = "No disponible"
EN_MANTENIMIENTO = "En mantenimiento"

# Archivos de equipos (fotos y manuales)
TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024      # 5 MB
TAMANO_MAXIMO_MANUAL = 10 * 1024 * 1024   # 10 MB
EQUIPOS_POR_PAGINA = 20                   # SRS 8.8


class Rol:
    ESTUDIANTE = "estudiante"
    ENCARGADO = "encargado"


# Seguridad de acceso (SRS 1, 1.1 y 2)
INTENTOS_MAXIMOS_LOGIN = 5
MINUTOS_BLOQUEO_LOGIN = 15
LONGITUD_MINIMA_CONTRASENA_ESTUDIANTE = 8
LONGITUD_MINIMA_CONTRASENA_ENCARGADO = 10

# Dominios de correo autorizados (SRS 1.3 y 2)
DOMINIOS_AUTORIZADOS = ("gmail.com", "alumno.ipn.mx", "ipn.mx")

# Mensajes que exige el SRS, escritos igual que en el documento
MENSAJE_CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos"   # SRS 1.2
MENSAJE_CORREO_NO_REGISTRADO = "Correo no registrado"                 # SRS 1.3
