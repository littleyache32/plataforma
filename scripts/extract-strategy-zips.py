import re
import sys
import zipfile
from pathlib import Path


SOURCE = Path(sys.argv[1])
OUTPUT = Path(sys.argv[2])


def safe_name(value: str) -> str:
    clean = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', '-', value).strip(' .')
    return clean[:180] or 'documento.pdf'


count = 0
total = 0
OUTPUT.mkdir(parents=True, exist_ok=True)
for zip_path in sorted(SOURCE.glob('*.zip')):
    folder = OUTPUT / zip_path.stem
    folder.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        pdf_entries = [entry for entry in archive.infolist() if not entry.is_dir() and entry.filename.lower().endswith('.pdf')]
        for index, entry in enumerate(pdf_entries, start=1):
            raw = archive.read(entry)
            destination = folder / f'{index:03d}-{safe_name(Path(entry.filename).name)}'
            destination.write_bytes(raw)
            count += 1
            total += len(raw)

print(f'PDFs extraidos: {count}')
print(f'Tamanho total: {total / 1024 / 1024:.1f} MB')
