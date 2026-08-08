import html
import json
import re
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'output' / 'pdf'


def load_env(path):
    values = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def slug(value):
    text = unicodedata.normalize('NFD', value).encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')


def fetch_materials(env):
    base = env['SUPABASE_URL'].rstrip('/')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SECRET_KEY')
    query = urllib.parse.urlencode({'select': 'nome,conteudo,materia:materia_id(nome,objetivo:objetivo_id(tipo))', 'limit': '1000'})
    request = urllib.request.Request(f'{base}/rest/v1/material?{query}', headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(request, timeout=90) as response:
        rows = json.loads(response.read().decode('utf-8'))
    return [row for row in rows if row.get('nome', '').startswith('Apostila completa - ') and row['nome'].count(' - ') >= 2]


def clean_inline(text):
    text = re.sub(r'\[([^]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    return text


def story_for_chapter(content, styles):
    story, buffer = [], []

    def flush():
        if not buffer:
            return
        text = ' '.join(part.strip() for part in buffer).strip()
        buffer.clear()
        if text:
            safe = clean_inline(html.escape(text, quote=False)).replace('&lt;b&gt;', '<b>').replace('&lt;/b&gt;', '</b>').replace('&lt;i&gt;', '<i>').replace('&lt;/i&gt;', '</i>')
            story.extend([Paragraph(safe, styles['BodyStudy']), Spacer(1, 3.2 * mm)])

    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            flush()
            continue
        heading = re.match(r'^(#{1,4})\s+(.+)$', line)
        if heading:
            flush()
            level = len(heading.group(1))
            style = styles['Chapter'] if level == 1 else styles['Section'] if level == 2 else styles['Subsection']
            story.extend([Paragraph(html.escape(heading.group(2)), style), Spacer(1, 2 * mm)])
        elif re.match(r'^[-*]\s+', line):
            flush()
            item = re.sub(r'^[-*]\s+', '', line)
            story.append(Paragraph(f'• {html.escape(item)}', styles['BulletStudy']))
        elif re.match(r'^\d+[.)]\s+', line):
            flush()
            story.append(Paragraph(html.escape(line), styles['BulletStudy']))
        elif line == '---':
            flush()
            story.append(Spacer(1, 3 * mm))
        else:
            buffer.append(line)
    flush()
    return story


def build_pdf(subject, context, chapters, output_file):
    regular, bold = Path('C:/Windows/Fonts/arial.ttf'), Path('C:/Windows/Fonts/arialbd.ttf')
    if regular.exists() and 'StudySans' not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont('StudySans', str(regular)))
        pdfmetrics.registerFont(TTFont('StudySans-Bold', str(bold)))
    font = 'StudySans' if regular.exists() else 'Helvetica'
    bold_font = 'StudySans-Bold' if bold.exists() else 'Helvetica-Bold'
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CoverTitle', fontName=bold_font, fontSize=24, leading=30, alignment=TA_CENTER, textColor=colors.HexColor('#173B36'), spaceAfter=14 * mm))
    styles.add(ParagraphStyle(name='CoverMeta', fontName=font, fontSize=11, leading=17, alignment=TA_CENTER, textColor=colors.HexColor('#4F625E')))
    styles.add(ParagraphStyle(name='Chapter', fontName=bold_font, fontSize=17, leading=22, textColor=colors.HexColor('#173B36'), spaceBefore=5 * mm, spaceAfter=3 * mm))
    styles.add(ParagraphStyle(name='Section', fontName=bold_font, fontSize=13, leading=17, textColor=colors.HexColor('#255D55'), spaceBefore=4 * mm, spaceAfter=2 * mm))
    styles.add(ParagraphStyle(name='Subsection', fontName=bold_font, fontSize=11, leading=15, textColor=colors.HexColor('#334844'), spaceBefore=3 * mm, spaceAfter=1.5 * mm))
    styles.add(ParagraphStyle(name='BodyStudy', fontName=font, fontSize=9.4, leading=14, alignment=TA_JUSTIFY, textColor=colors.HexColor('#202927'), splitLongWords=True))
    styles.add(ParagraphStyle(name='BulletStudy', fontName=font, fontSize=9.2, leading=13.5, leftIndent=5 * mm, firstLineIndent=-3 * mm, textColor=colors.HexColor('#202927'), spaceAfter=1.5 * mm))

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#D8E4E1'))
        canvas.line(18 * mm, A4[1] - 16 * mm, A4[0] - 18 * mm, A4[1] - 16 * mm)
        canvas.setFont(font, 7.5)
        canvas.setFillColor(colors.HexColor('#60736F'))
        canvas.drawString(18 * mm, A4[1] - 12 * mm, subject[:75])
        canvas.drawRightString(A4[0] - 18 * mm, 11 * mm, f'Página {doc.page}')
        canvas.restoreState()

    doc = SimpleDocTemplate(str(output_file), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm, topMargin=22 * mm, bottomMargin=18 * mm, title=f'Apostila completa - {subject}', author='Mentor de Estudos')
    story = [Spacer(1, 45 * mm), Paragraph('APOSTILA COMPLETA', styles['CoverMeta']), Spacer(1, 8 * mm), Paragraph(html.escape(subject), styles['CoverTitle']), Paragraph('Faculdade' if context == 'faculdade' else 'BACEN Técnico - Área 1', styles['CoverMeta']), Spacer(1, 8 * mm), Paragraph(f'{len(chapters)} capítulos para estudo autônomo', styles['CoverMeta']), PageBreak()]
    for index, row in enumerate(chapters):
        if index:
            story.append(PageBreak())
        story.extend(story_for_chapter(row['conteudo'], styles))
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


def main():
    rows = fetch_materials(load_env(ROOT / '.env.local'))
    grouped = {}
    for row in rows:
        subject = row['materia']['nome']
        grouped.setdefault(subject, {'context': row['materia']['objetivo']['tipo'], 'chapters': []})['chapters'].append(row)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    files = []
    for subject, data in sorted(grouped.items()):
        data['chapters'].sort(key=lambda item: item['nome'])
        output_file = OUTPUT / f'apostila-{slug(subject)}.pdf'
        build_pdf(subject, data['context'], data['chapters'], output_file)
        files.append(output_file)
        print(json.dumps({'apostila': subject, 'capitulos': len(data['chapters']), 'arquivo': str(output_file)}, ensure_ascii=False))
    zip_path = OUTPUT / 'colecao-completa-faculdade-bacen.zip'
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
        for file in files:
            archive.write(file, file.name)
    print(json.dumps({'concluido': True, 'apostilas': len(files), 'zip': str(zip_path)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
