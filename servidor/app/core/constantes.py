"""Valores fijos que coinciden con los catálogos insertados por 01_esquema.sql.

Si cambias un ID en la base de datos, cámbialo también aquí.
"""


class EstadoCuenta:
    ACTIVA = 1
    SUSPENDIDA = 2   # bloqueo manual por adeudos (SRS 8.13)
    BLOQUEADA = 3    # bloqueo temporal por intentos fallidos (SRS 1.1)


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
