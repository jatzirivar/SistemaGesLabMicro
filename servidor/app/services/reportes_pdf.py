"""Generación de PDF con reportlab: comprobante de retiro (SRS 7.2) e historial (SRS 8.15)."""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.tiempo import a_local, ahora

TITULO_SISTEMA = "Laboratorio de Microprocesadores · ESIME CU"
AZUL = colors.HexColor("#1F3A5F")
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

def _firmas() -> Table:
    centrado = ParagraphStyle("firma", parent=ESTILO_TEXTO, alignment=TA_CENTER)
    tabla = Table([["", "", ""], [_p("Firma del estudiante", centrado), "", _p("Firma del encargado", centrado)]],
                  colWidths=[7.5 * cm, 2 * cm, 7.5 * cm], rowHeights=[1.6 * cm, None])
    tabla.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (0, 0), 0.6, colors.black),
        ("LINEBELOW", (2, 0), (2, 0), 0.6, colors.black),
    ]))
    return tabla


def comprobante(datos: dict) -> bytes:
    """Folio, estudiante, boleta, equipos (nombre y código) y fecha/hora de retiro y devolución."""
    salida = BytesIO()
    doc = SimpleDocTemplate(salida, pagesize=letter, title=f"Comprobante {datos['folio']}",
                            leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)

    general = [
        [_p("Folio", ESTILO_TEXTO), _p(datos["folio"], ESTILO_TEXTO)],
        [_p("Estado", ESTILO_TEXTO), _p(datos["estado"], ESTILO_TEXTO)],
        [_p("Estudiante", ESTILO_TEXTO), _p(datos["estudiante"], ESTILO_TEXTO)],
        [_p("Boleta", ESTILO_TEXTO), _p(datos["boleta"], ESTILO_TEXTO)],
        [_p("Grupo", ESTILO_TEXTO), _p(datos["grupo"], ESTILO_TEXTO)],
        [_p("Retiro", ESTILO_TEXTO), _p(_fecha(datos["fecha_hora_retiro"]), ESTILO_TEXTO)],
        [_p("Devolución", ESTILO_TEXTO), _p(_fecha(datos["fecha_hora_devolucion"]), ESTILO_TEXTO)],
    ]
    tabla_general = _tabla(general, [4 * cm, 13 * cm], encabezado=False)
    tabla_general.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), GRIS_CLARO),
                                       ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold")]))

    equipos = [[_p("Código", ESTILO_ENCABEZADO), _p("Equipo", ESTILO_ENCABEZADO),
                _p("Categoría", ESTILO_ENCABEZADO)]]
    equipos += [[_p(e["codigo_inventario"]), _p(e["nombre"]), _p(e["categoria"])] for e in datos["equipos"]]

    elementos = [
        Paragraph("Comprobante de retiro de equipo", ESTILO_TITULO),
        Paragraph(escape(TITULO_SISTEMA), ESTILO_SUBTITULO),
        tabla_general,
        Spacer(1, 12),
        Paragraph("<b>Equipos</b>", ESTILO_TEXTO),
        Spacer(1, 4),
        _tabla(equipos, [3 * cm, 9.5 * cm, 4.5 * cm]),
        Spacer(1, 30),
        _firmas(),
    ]
    doc.build(elementos, onFirstPage=_numerar_paginas, onLaterPages=_numerar_paginas)
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
