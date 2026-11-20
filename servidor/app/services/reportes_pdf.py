"""Generación de PDF con reportlab: comprobante de retiro (SRS 7.2) e historial (SRS 8.15)."""
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.tiempo import a_local, ahora

TITULO_SISTEMA = "Laboratorio de Microprocesadores · ESIME CU"
AZUL = colors.HexColor("#550000")  # encabezados de reportes con el vino del SRS 1.1
GRIS_CLARO = colors.HexColor("#EEF2F6")
GRIS_LINEA = colors.HexColor("#B8C2CC")

_estilos = getSampleStyleSheet()
ESTILO_TITULO = ParagraphStyle("titulo", parent=_estilos["Title"], fontSize=16, textColor=AZUL, spaceAfter=2)
ESTILO_SUBTITULO = ParagraphStyle("subtitulo", parent=_estilos["Normal"], fontSize=9, textColor=colors.grey,
                                  alignment=TA_CENTER, spaceAfter=10)
ESTILO_TEXTO = ParagraphStyle("texto", parent=_estilos["Normal"], fontSize=9, leading=11)
ESTILO_CELDA = ParagraphStyle("celda", parent=_estilos["Normal"], fontSize=7.5, leading=9)
ESTILO_ENCABEZADO = ParagraphStyle("encabezado", parent=ESTILO_CELDA, textColor=colors.white,
                                   fontName="Helvetica-Bold")
ESTILO_PIE = ParagraphStyle("pie", parent=_estilos["Normal"], fontSize=7.5, textColor=colors.grey)


def _p(texto, estilo=ESTILO_CELDA) -> Paragraph:
    return Paragraph(escape("" if texto is None else str(texto)), estilo)


def _fecha(valor: datetime | None) -> str:
    return f"{a_local(valor):%d/%m/%Y %H:%M}" if valor else "—"


def _numerar_paginas(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.grey)
    ancho, _ = doc.pagesize
    canvas.drawString(doc.leftMargin, 1.2 * cm, f"Generado el {ahora():%d/%m/%Y %H:%M}")
    canvas.drawRightString(ancho - doc.rightMargin, 1.2 * cm, f"Página {doc.page}")
    canvas.restoreState()


def _tabla(datos: list[list], anchos: list[float], encabezado: bool = True) -> Table:
    tabla = Table(datos, colWidths=anchos, repeatRows=1 if encabezado else 0)
    estilo = [
        ("GRID", (0, 0), (-1, -1), 0.4, GRIS_LINEA),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if encabezado:
        estilo += [("BACKGROUND", (0, 0), (-1, 0), AZUL),
                   ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS_CLARO])]
    tabla.setStyle(TableStyle(estilo))
    return tabla


# ================================================================ comprobante (SRS 7.2)

GUINDA = colors.HexColor("#550000")  # vino institucional (SRS 1.1)
GRIS_ETIQUETA = colors.HexColor("#F2F2F2")
GRIS_BORDE = colors.HexColor("#C8C8C8")
ESCUDO = Path(__file__).resolve().parent.parent / "static" / "logo-esime.png"

_C_TITULO = ParagraphStyle("c_titulo", parent=_estilos["Normal"], fontName="Helvetica-Bold", fontSize=22,
                           leading=26, textColor=GUINDA)
_C_SUBTITULO = ParagraphStyle("c_subtitulo", parent=_estilos["Normal"], fontSize=9.5, leading=12,
                              textColor=colors.HexColor("#555555"))
_C_SECCION = ParagraphStyle("c_seccion", parent=_estilos["Normal"], fontName="Helvetica-Bold", fontSize=14,
                            leading=18, spaceBefore=14, spaceAfter=8)
_C_ETIQUETA = ParagraphStyle("c_etiqueta", parent=_estilos["Normal"], fontName="Helvetica-Bold", fontSize=10,
                             leading=12)
_C_VALOR = ParagraphStyle("c_valor", parent=_estilos["Normal"], fontSize=10, leading=12)
_C_NOTA = ParagraphStyle("c_nota", parent=_estilos["Normal"], fontSize=9.5, leading=12, spaceBefore=10)


def _tabla_comprobante(filas: list[list], anchos: list[float], encabezado: bool) -> Table:
    tabla = Table(filas, colWidths=anchos, hAlign="LEFT")
    estilo = [
        ("GRID", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]
    if encabezado:
        estilo.append(("BACKGROUND", (0, 0), (-1, 0), GRIS_ETIQUETA))   # fila de títulos
    else:
        estilo.append(("BACKGROUND", (0, 0), (0, -1), GRIS_ETIQUETA))   # columna de etiquetas
    tabla.setStyle(TableStyle(estilo))
    return tabla


def comprobante(datos: dict) -> bytes:
    """SRS 7.2: escudo, folio, estudiante, boleta, grupo, retiro, devolución y equipos (nombre y código).

    Sin firmas y sin el PIN (por seguridad el PIN solo se muestra en el sistema).
    """
    salida = BytesIO()
    doc = SimpleDocTemplate(salida, pagesize=letter, title=f"Comprobante {datos['folio']}",
                            leftMargin=1.8 * cm, rightMargin=1.8 * cm, topMargin=1.6 * cm, bottomMargin=1.6 * cm)
    ancho_util = letter[0] - doc.leftMargin - doc.rightMargin

    # Encabezado: escudo a la izquierda, título y subtítulo a la derecha
    texto = [Paragraph(f"Comprobante de retiro {escape(datos['folio'])}", _C_TITULO),
             Paragraph(f"ESIME Culhuacán · Laboratorio de Microprocesadores · Generado el "
                       f"{ahora():%d/%m/%Y, %H:%M:%S}", _C_SUBTITULO)]
    escudo = Image(str(ESCUDO), width=1.9 * cm, height=1.9 * cm * 143 / 160) if ESCUDO.is_file() else ""
    encabezado = Table([[escudo, texto]], colWidths=[2.4 * cm, ancho_util - 2.4 * cm], hAlign="LEFT")
    encabezado.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                    ("LEFTPADDING", (0, 0), (-1, -1), 0)]))

    def fila(etiqueta, valor):
        return [Paragraph(etiqueta, _C_ETIQUETA), Paragraph(escape(str(valor)), _C_VALOR)]

    general = _tabla_comprobante([
        [Paragraph("Folio", _C_ETIQUETA), Paragraph(f"<b>{escape(datos['folio'])}</b>", _C_VALOR)],
        fila("Estudiante", datos["estudiante"]),
        fila("Boleta", datos["boleta"]),
        fila("Grupo", datos["grupo"]),
        fila("Retiro", f"{a_local(datos['fecha_hora_retiro']):%d/%m/%Y %H:%M} h"),
        fila("Devolución", f"{a_local(datos['fecha_hora_devolucion']):%d/%m/%Y %H:%M} h"),
    ], [2.9 * cm, 7 * cm], encabezado=False)

    equipos = [[Paragraph("Equipo", _C_ETIQUETA), Paragraph("Código", _C_ETIQUETA)]]
    equipos += [[Paragraph(escape(e["nombre"]), _C_VALOR), Paragraph(escape(e["codigo_inventario"]), _C_VALOR)]
                for e in datos["equipos"]]

    elementos = [
        encabezado,
        Spacer(1, 6),
        HRFlowable(width="100%", thickness=2, color=GUINDA, spaceBefore=4, spaceAfter=12),
        general,
        Paragraph("Equipos", _C_SECCION),
        _tabla_comprobante(equipos, [ancho_util * 0.72, ancho_util * 0.28], encabezado=True),
        Paragraph("Presenta tu PIN en ventanilla. Por seguridad el PIN no se imprime.", _C_NOTA),
    ]
    doc.build(elementos)
    return salida.getvalue()


# ================================================================ historial (SRS 8.15)

def historial(filas: list[dict], filtros: list[str], recortado_a: int = 0) -> bytes:
    salida = BytesIO()
    doc = SimpleDocTemplate(salida, pagesize=landscape(letter), title="Historial de préstamos",
                            leftMargin=1.2 * cm, rightMargin=1.2 * cm, topMargin=1.5 * cm, bottomMargin=2 * cm)

    encabezado = ["Folio", "Estado", "Estudiante", "Boleta", "Grupo", "Equipos",
                  "Retiro", "Límite", "Entrega real", "Devolución real", "Inc."]
    datos = [[_p(t, ESTILO_ENCABEZADO) for t in encabezado]]
    for f in filas:
        equipos = ", ".join(f"{e['codigo_inventario']} {e['nombre']}" for e in f["equipos"])
        datos.append([
            _p(f["folio"]), _p(f["estado"]), _p(f["estudiante"]), _p(f["boleta"]), _p(f["grupo"]),
            _p(equipos), _p(_fecha(f["fecha_hora_prog_retiro"])), _p(_fecha(f["fecha_hora_limite_devolucion"])),
            _p(_fecha(f["fecha_hora_real_entrega"])), _p(_fecha(f["fecha_hora_real_devolucion"])),
            _p(f["incidencias"]),
        ])

    anchos = [3.0, 1.9, 3.2, 2.0, 1.3, 4.2, 2.2, 2.2, 2.2, 2.2, 1.0]   # 25.4 cm de ancho útil
    elementos = [
        Paragraph("Historial de préstamos", ESTILO_TITULO),
        Paragraph(escape(TITULO_SISTEMA), ESTILO_SUBTITULO),
        Paragraph(escape("Filtros: " + ("; ".join(filtros) if filtros else "ninguno")), ESTILO_TEXTO),
        Paragraph(escape(f"Total de registros: {len(filas)}"), ESTILO_TEXTO),
    ]
    if recortado_a:
        elementos.append(Paragraph(escape(f"Se muestran solo los primeros {recortado_a} registros; "
                                          "usa filtros más específicos para ver el resto."), ESTILO_PIE))
    elementos.append(Spacer(1, 8))
    if filas:
        elementos.append(_tabla(datos, [a * cm for a in anchos]))
    else:
        elementos.append(Paragraph("No hay préstamos que coincidan con los filtros.", ESTILO_TEXTO))

    doc.build(elementos, onFirstPage=_numerar_paginas, onLaterPages=_numerar_paginas)
    return salida.getvalue()
