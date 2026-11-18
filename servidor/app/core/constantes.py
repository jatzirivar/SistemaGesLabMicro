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
