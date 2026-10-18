"""Create deterministic submission/source ZIPs from already verified builds."""
from pathlib import Path
import hashlib
import json
import os
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def archive(destination, files):
    temporary_directory = ROOT / 'dist'
    temporary_directory.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix='navega-package-', suffix='.zip', dir=temporary_directory)
    os.close(handle)
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
            for name, source in sorted(files.items()):
                assert not source.is_symlink(), source
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                output.writestr(info, source.read_bytes())
        with zipfile.ZipFile(temporary) as output:
            assert output.testzip() is None
            assert set(output.namelist()) == set(files)
            for name, source in files.items():
                assert output.read(name) == source.read_bytes(), name
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    directory = ROOT / 'packages/history' / ('v' + version)
    directory.mkdir(parents=True, exist_ok=True)
    assets = []
    for target in ('chromium', 'firefox'):
        build = ROOT / 'dist' / target
        manifest = json.loads((build / 'manifest.json').read_text())
        assert manifest['version'] == version
        destination = directory / f'navega-livre-{target}-v{version}.zip'
        archive(destination, {p.relative_to(build).as_posix(): p for p in build.rglob('*') if p.is_file()})
        assets.append(destination)
    files = {name: ROOT / name for name in ('package.json', 'BUILD-FIREFOX.md', 'LICENSE')}
    for p in (ROOT / 'extension').rglob('*'):
        relative = p.relative_to(ROOT)
        if p.is_file() and not set(relative.parts).intersection({'tests', 'dist', 'node_modules', '__pycache__', '.git'}) and p.name != 'RELATORIO.md':
            files[relative.as_posix()] = p
    source = directory / f'navega-livre-codigo-fonte-v{version}.zip'
    archive(source, files)
    assets.append(source)
    license_file = directory / 'LICENSE-MIT.txt'
    license_file.write_bytes((ROOT / 'LICENSE').read_bytes())
    assets.append(license_file)
    digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
    sums = directory / 'SHA256SUMS.txt'
    sums.write_text(''.join(f'{digest(p)}  {p.name}\n' for p in sorted(assets)))
    assets.append(sums)
    catalog_file = ROOT / '.github/release-history.json'
    catalog = json.loads(catalog_file.read_text())
    for entry in catalog:
        entry['latest'] = False
        if entry['tag'] == 'v0.7.1':
            entry['target'] = '8bf916d89f4cfbf817589afa8f482bf3af130ed5'
    catalog = [entry for entry in catalog if entry['tag'] != 'v' + version]
    catalog.append({'tag': 'v' + version, 'name': f'Navega Livre {version} — Firefox Android e interface de toque',
                    'target': 'current', 'notes': f'.github/release-notes/v{version}.md', 'latest': True,
                    'assets': [{'path': p.relative_to(ROOT).as_posix(), 'sha256': digest(p)} for p in assets]})
    catalog_file.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'version': version, 'assets': [{'name': p.name, 'bytes': p.stat().st_size, 'sha256': digest(p)} for p in assets]}))


if __name__ == '__main__':
    main()
