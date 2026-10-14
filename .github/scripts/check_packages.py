"""Check the current ZIPs against built files before the release job can run."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[2]
version = json.loads((ROOT / 'extension/package.json').read_text())['version']
catalog = json.loads((ROOT / '.github/release-history.json').read_text())
entry = next(x for x in catalog if x['tag'] == 'v' + version)
assert entry['latest'] is True
for target in ('chromium', 'firefox'):
    expected_name = f'navega-livre-{target}-v{version}.zip'
    asset = next(x for x in entry['assets'] if Path(x['path']).name == expected_name)
    path = ROOT / asset['path']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256']
    build = ROOT / 'dist' / target
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        files = {x.filename.removeprefix('navega-livre/'): x for x in archive.infolist() if not x.is_dir()}
        expected = {str(x.relative_to(build)): x for x in build.rglob('*') if x.is_file()}
        assert set(files) == set(expected), f'Files differ in {target}'
        for name, p in expected.items():
            assert archive.read(files[name]) == p.read_bytes(), f'Package differs: {target}/{name}'
        manifest = json.loads(archive.read(files['manifest.json']))
        assert manifest['version'] == version
        assert 'webNavigation' in manifest['permissions']
    print('PASS exact package integrity', target, version, flush=True)
