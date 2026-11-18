"""Convierte los errores de validación de FastAPI a mensajes en español (SRS 1.8).

Todas las respuestas de error tienen la forma:
    {"detail": "Mensaje principal", "errores": [{"campo": "...", "mensaje": "..."}]}
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

_MENSAJES_POR_TIPO = {
    "missing": "Este campo es obligatorio",
    "string_type": "Debe ser texto",
    "int_type": "Debe ser un número entero",
    "int_parsing": "Debe ser un número entero",
    "bool_type": "Debe ser verdadero o falso",
    "bool_parsing": "Debe ser verdadero o falso",
    "json_invalid": "El cuerpo de la petición no es un JSON válido",
    "model_attributes_type": "Formato de datos inválido",
    "greater_than_equal": "El valor es menor al mínimo permitido",
    "less_than_equal": "El valor es mayor al máximo permitido",
    "literal_error": "Valor no permitido",
    "date_parsing": "Fecha inválida, usa el formato AAAA-MM-DD",
    "date_from_datetime_parsing": "Fecha inválida, usa el formato AAAA-MM-DD",
    "date_type": "Fecha inválida, usa el formato AAAA-MM-DD",
    "time_parsing": "Hora inválida, usa el formato HH:MM",
    "time_type": "Hora inválida, usa el formato HH:MM",
    "list_type": "Debe ser una lista",
}


class ErrorDeNegocio(Exception):
    """Regla del laboratorio que no se cumple. Puede llevar varios motivos a la vez.

    Responde con el mismo formato que los errores de validación.
    """

    def __init__(self, errores: list[str] | str, status_code: int = 409):
        self.errores = [errores] if isinstance(errores, str) else list(errores)
        self.status_code = status_code
        super().__init__(self.errores[0] if self.errores else "Operación no permitida")


def _mensaje(error: dict) -> str:
    if error.get("type") == "value_error":
        # Nuestros ValueError llegan como "Value error, <mensaje>"
        return str(error.get("msg", "")).removeprefix("Value error, ")
    return _MENSAJES_POR_TIPO.get(error.get("type"), "Valor inválido")


def _campo(error: dict) -> str:
    partes = [str(p) for p in error.get("loc", ()) if p not in ("body", "query", "path")]
    return ".".join(partes) or "general"


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def error_de_validacion(_: Request, exc: RequestValidationError):
        errores = [{"campo": _campo(e), "mensaje": _mensaje(e)} for e in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={"detail": errores[0]["mensaje"] if errores else "Datos inválidos",
                     "errores": errores},
        )

    @app.exception_handler(ErrorDeNegocio)
    async def error_de_negocio(_: Request, exc: ErrorDeNegocio):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc),
                     "errores": [{"campo": "general", "mensaje": m} for m in exc.errores]},
        )
