"""Crea una cuenta de Encargado de Laboratorio.

Ejecutar desde la carpeta "servidor", con el entorno virtual activado:
    python -m scripts.crear_encargado
"""
from getpass import getpass

from sqlalchemy import func, select

from app.core.constantes import LONGITUD_MINIMA_CONTRASENA_ENCARGADO, EstadoCuenta
from app.core.database import SesionLocal
from app.core.seguridad import generar_hash
from app.core.validaciones import validar_contrasena, validar_formato_correo, validar_nombre
from app.models.usuarios import Encargado


def preguntar(texto: str, validar, opcional: bool = False):
    """Repite la pregunta hasta recibir un valor válido."""
    while True:
        valor = input(texto).strip()
        if opcional and not valor:
            return None
        try:
            return validar(valor)
        except ValueError as error:
            print(f"  ✗ {error}")


def preguntar_contrasena() -> str:
    print(f"\nLa contraseña debe tener al menos {LONGITUD_MINIMA_CONTRASENA_ENCARGADO} caracteres, "
          "una mayúscula, una minúscula, un número y sin espacios.")
    print("(Al escribirla no se verá nada en pantalla; es normal.)")
    while True:
        contrasena = getpass("Contraseña: ")
        try:
            validar_contrasena(contrasena, LONGITUD_MINIMA_CONTRASENA_ENCARGADO)
        except ValueError as error:
            print(f"  ✗ {error}")
            continue
        if getpass("Confirma la contraseña: ") != contrasena:
            print("  ✗ Las contraseñas no coinciden")
            continue
        return contrasena


def main() -> None:
    print("=== Crear cuenta de Encargado de Laboratorio ===\n")
    nombre = preguntar("Nombre: ", lambda v: validar_nombre(v, "El nombre"))
    apellido_pat = preguntar("Apellido paterno: ", lambda v: validar_nombre(v, "El apellido paterno"))
    apellido_mat = preguntar("Apellido materno (Enter para omitir): ",
                             lambda v: validar_nombre(v, "El apellido materno"), opcional=True)
    correo = preguntar("Correo: ", validar_formato_correo)
    contrasena = preguntar_contrasena()

    with SesionLocal() as db:
        existe = db.scalar(select(Encargado.id_encargado).where(func.lower(Encargado.correo) == correo))
        if existe:
            print(f"\n✗ Ya existe un encargado con el correo {correo}")
            return

        encargado = Encargado(
            nombre=nombre,
            apellido_pat=apellido_pat,
            apellido_mat=apellido_mat,
            correo=correo,
            contrasena_hash=generar_hash(contrasena),
            intentos_fallidos=0,
            id_estado_cuenta=EstadoCuenta.ACTIVA,
        )
        db.add(encargado)
        db.commit()
        print(f"\n✓ Encargado creado: {encargado.nombre_completo} <{correo}> (id {encargado.id_encargado})")
        print("  Ya puede iniciar sesión con su correo y contraseña.")


if __name__ == "__main__":
    main()
