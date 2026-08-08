import json
import zipfile
from pathlib import Path

from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
output = root / 'output' / 'pdf'
pdfs = sorted(output.glob('*__*.pdf'))
if len(pdfs) != 14:
    raise RuntimeError(f'Esperados 14 PDFs, encontrados {len(pdfs)}.')

summary = []
for pdf in pdfs:
    reader = PdfReader(str(pdf))
    if len(reader.pages) < 5:
        raise RuntimeError(f'PDF curto demais: {pdf.name}')
    text = '\n'.join((page.extract_text() or '') for page in reader.pages)
    if '<b>' in text or '</b>' in text or '<i>' in text or '</i>' in text:
        raise RuntimeError(f'Marcação HTML aparente em {pdf.name}.')
    if 'Material completo de estudo' not in text or 'Fontes verificadas' not in text:
        raise RuntimeError(f'Estrutura obrigatória ausente em {pdf.name}.')
    summary.append({'arquivo': pdf.name, 'paginas': len(reader.pages), 'caracteres': len(text)})

zip_path = output / 'colecao-completa-material-de-estudo.zip'
with zipfile.ZipFile(zip_path) as archive:
    names = archive.namelist()
    if sorted(names) != sorted(pdf.name for pdf in pdfs):
        raise RuntimeError('O ZIP não contém exatamente os 14 PDFs finais.')

print(json.dumps({'pdfs': len(pdfs), 'paginas': sum(item['paginas'] for item in summary), 'zip_arquivos': len(names), 'detalhes': summary}, ensure_ascii=False))
