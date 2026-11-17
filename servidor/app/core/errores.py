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
}


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
