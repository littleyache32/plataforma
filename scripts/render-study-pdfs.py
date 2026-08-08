import json
import re
import unicodedata
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'tmp' / 'pdfs' / 'study_materials.json'
OUTPUT = ROOT / 'output' / 'pdf'
OUTPUT.mkdir(parents=True, exist_ok=True)

font_regular = Path('C:/Windows/Fonts/arial.ttf')
font_bold = Path('C:/Windows/Fonts/arialbd.ttf')
if font_regular.exists() and font_bold.exists():
    pdfmetrics.registerFont(TTFont('StudySans', str(font_regular)))
    pdfmetrics.registerFont(TTFont('StudySansBold', str(font_bold)))
else:
    raise RuntimeError('Fontes Arial não encontradas para gerar os PDFs.')

BASE = 'StudySans'
BOLD = 'StudySansBold'

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle', fontName=BOLD, fontSize=23, leading=29, textColor=colors.HexColor('#17233A'), alignment=TA_CENTER, spaceAfter=15))
styles.add(ParagraphStyle(name='CoverSub', fontName=BASE, fontSize=11, leading=16, textColor=colors.HexColor('#536179'), alignment=TA_CENTER))
styles.add(ParagraphStyle(name='Chapter', fontName=BOLD, fontSize=18, leading=23, textColor=colors.HexColor('#17233A'), spaceAfter=12, spaceBefore=4))
styles.add(ParagraphStyle(name='H2x', fontName=BOLD, fontSize=13, leading=17, textColor=colors.HexColor('#245D57'), spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle(name='H3x', fontName=BOLD, fontSize=11, leading=15, textColor=colors.HexColor('#34445C'), spaceBefore=9, spaceAfter=4))
styles.add(ParagraphStyle(name='Bodyx', fontName=BASE, fontSize=9.4, leading=14, textColor=colors.HexColor('#242B36'), alignment=TA_JUSTIFY, spaceAfter=7))
styles.add(ParagraphStyle(name='Bulletx', fontName=BASE, fontSize=9.2, leading=13.5, leftIndent=14, firstLineIndent=-7, textColor=colors.HexColor('#242B36'), spaceAfter=4))
styles.add(ParagraphStyle(name='Tocx', fontName=BASE, fontSize=10, leading=15, leftIndent=8, textColor=colors.HexColor('#34445C'), spaceAfter=3))

def slug(value):
    normalized = unicodedata.normalize('NFD', value).encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9]+', '-', normalized).strip('-')

def safe_text(value):
    value = re.sub(r'```(?:markdown)?', '', value, flags=re.I)
    value = value.replace('```', '')
    return escape(value.replace('*', ''))

def markdown_flowables(text):
    flow = []
    pending = []

    def flush():
        if pending:
            paragraph = ' '.join(part.strip() for part in pending if part.strip())
            if paragraph:
                flow.append(Paragraph(safe_text(paragraph), styles['Bodyx']))
            pending.clear()

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            flush()
            continue
        if re.fullmatch(r'-{3,}', line):
            flush()
            flow.append(Spacer(1, 5 * mm))
            continue
        heading = re.match(r'^(#{1,4})\s+(.+)$', line)
        if heading:
            flush()
            level = len(heading.group(1))
            style = styles['H2x'] if level <= 2 else styles['H3x']
            flow.append(Paragraph(safe_text(heading.group(2)), style))
            continue
        bullet = re.match(r'^[-*]\s+(.+)$', line)
        if bullet:
            flush()
            flow.append(Paragraph('• ' + safe_text(bullet.group(1)), styles['Bulletx']))
            continue
        pending.append(line)
    flush()
    return flow

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(BASE, 8)
    canvas.setFillColor(colors.HexColor('#7A8494'))
    canvas.drawString(20 * mm, 12 * mm, 'Mentor de Estudos')
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f'Página {doc.page}')
    canvas.restoreState()

def build_pdf(context, subject, chapters):
    filename = f"{slug(context)}__{slug(subject)}.pdf"
    output = OUTPUT / filename
    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=19 * mm, leftMargin=19 * mm, topMargin=18 * mm, bottomMargin=19 * mm, title=f'{subject} - Material de estudo', author='Mentor de Estudos')
    story = [Spacer(1, 36 * mm), Paragraph(escape(subject), styles['CoverTitle']), Paragraph(f'Material completo de estudo | {escape(context)}', styles['CoverSub']), Spacer(1, 8 * mm), Paragraph(f'{len(chapters)} capítulos organizados para estudo autônomo. Sem questões ou gabaritos.', styles['CoverSub']), PageBreak(), Paragraph('Sumário', styles['Chapter'])]
    for index, chapter in enumerate(chapters, 1):
        story.append(Paragraph(f'{index}. {escape(chapter["topico"])}', styles['Tocx']))
    for index, chapter in enumerate(chapters, 1):
        story.extend([PageBreak(), Paragraph(f'{index}. {escape(chapter["topico"])}', styles['Chapter'])])
        content = chapter['conteudo']
        content = re.sub(r'^#{1,3}\s+' + re.escape(chapter['topico']) + r'\s*$', '', content, count=1, flags=re.I | re.M)
        story.extend(markdown_flowables(content))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output

chapters = json.loads(INPUT.read_text(encoding='utf-8'))
grouped = {}
for chapter in chapters:
    key = (chapter['contexto'], chapter['materia'])
    grouped.setdefault(key, []).append(chapter)

files = []
for (context, subject), subject_chapters in sorted(grouped.items()):
    files.append(build_pdf(context, subject, subject_chapters))

zip_path = OUTPUT / 'colecao-completa-material-de-estudo.zip'
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in files:
        archive.write(file, file.name)

print(json.dumps({'pdfs': len(files), 'capitulos': len(chapters), 'zip': str(zip_path), 'arquivos': [str(file) for file in files]}, ensure_ascii=False))
