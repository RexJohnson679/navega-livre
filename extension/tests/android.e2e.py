"""Native Firefox Android smoke test in a disposable, rooted Android emulator.

Production files are copied byte-for-byte. Only the manifest adds a test-only
background script; no extra permissions, user profile or account is used.
"""
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BUILD = Path(os.environ.get('NAVEGA_EXTENSION_DIR', ROOT.parent / 'dist/firefox')).resolve()


def adb(*args, **kwargs):
    return subprocess.check_output(['adb', *args], text=True, **kwargs).strip()


def main():
    result, done = {}, threading.Event()
    token = secrets.token_hex(16)

    class Handler(BaseHTTPRequestHandler):
        def end_headers(self):
            # QA status transport must work even while diagnosing host grants.
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            super().end_headers()

        def do_OPTIONS(self):
            self.send_response(204)
            self.end_headers()

        def do_GET(self):
            if self.path.startswith('/adsbygoogle.js'):
                mime, body = 'application/javascript', 'window.fixtureAdScript=true;'
            else:
                mime = 'text/html; charset=utf-8'
                body = '''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>ytm-comment-section-renderer{display:block}</style></head><body style="overflow:hidden">
                <main id="reader">Artigo normal preservado</main><div class="ad-banner" id="ad">Publicidade</div>
                <div role="dialog" id="notice" style="position:fixed;inset:0;background:white">Desative o bloqueador de anúncios para continuar.</div>
                <ytm-comment-section-renderer id="comments-mobile">Comentários</ytm-comment-section-renderer></body></html>'''
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body.encode())

        def do_POST(self):
            if self.path not in ('/result/' + token, '/progress/' + token):
                self.send_error(404)
                return
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length < 20000:
                self.send_error(400)
                return
            payload = json.loads(self.rfile.read(length))
            self.send_response(200)
            self.end_headers()
            if self.path.startswith('/result/'):
                result.update(payload)
                done.set()
            else:
                print('NATIVE_ANDROID_PROGRESS', json.dumps(payload), flush=True)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    process = None
    try:
        with tempfile.TemporaryDirectory(prefix='navega-android-') as temp:
            temp = Path(temp)
            # QA emulator only: enable the documented USB-debugging preference.
            adb('root')
            adb('wait-for-device')
            adb('shell', 'monkey', '-p', 'org.mozilla.firefox', '-c', 'android.intent.category.LAUNCHER', '1', stderr=subprocess.DEVNULL)
            time.sleep(3)
            adb('shell', 'am', 'force-stop', 'org.mozilla.firefox')
            # Fenix Settings.FENIX_PREFERENCES is explicitly fenix_preferences,
            # not Android's package-named default preferences file.
            prefs_path = '/data/data/org.mozilla.firefox/shared_prefs/fenix_preferences.xml'
            try:
                preferences = ET.fromstring(adb('shell', 'cat', prefs_path))
            except (subprocess.CalledProcessError, ET.ParseError):
                preferences = ET.Element('map')
            values = {'pref_key_remote_debugging': ('boolean', 'true'),
                      'pref_key_terms_accepted': ('boolean', 'true'),
                      'pref_key_onboarding_completed_timestamp': ('long', str(int(time.time()*1000)))}
            for name, (kind, value) in values.items():
                for child in list(preferences):
                    if child.get('name') == name:
                        preferences.remove(child)
                ET.SubElement(preferences, kind, name=name, value=value)
            pref_file = temp / 'preferences.xml'
            ET.ElementTree(preferences).write(pref_file, encoding='utf-8', xml_declaration=True)
            uid = adb('shell', 'stat', '-c', '%u', '/data/data/org.mozilla.firefox')
            adb('shell', 'mkdir', '-p', '/data/data/org.mozilla.firefox/shared_prefs')
            adb('push', str(pref_file), prefs_path)
            adb('shell', 'chown', uid+':'+uid, prefs_path)
            adb('shell', 'restorecon', prefs_path)
            saved = ET.fromstring(adb('shell', 'cat', prefs_path))
            assert any(item.get('name') == 'pref_key_remote_debugging' and
                       item.get('value') == 'true' for item in saved)
            # Supported GeckoView automation configuration, confined to this
            # disposable emulator. Allow this test's debugger connection, as a
            # developer would confirm on the device. Production is untouched.
            debug_config = temp / 'geckoview-config.yaml'
            debug_config.write_text('prefs:\n  devtools.debugger.prompt-connection: false\n'
                                    '  devtools.console.stdout.chrome: true\n'
                                    '  devtools.console.stdout.content: true\n')
            adb('push', str(debug_config), '/data/local/tmp/org.mozilla.firefox-geckoview-config.yaml')
            adb('shell', 'am', 'set-debug-app', '--persistent', 'org.mozilla.firefox')
            source = temp / 'extension'
            shutil.copytree(BUILD, source)
            for file in BUILD.rglob('*'):
                if file.is_file():
                    assert file.read_bytes() == (source / file.relative_to(BUILD)).read_bytes()
            manifest = json.loads((source / 'manifest.json').read_text())
            manifest['background']['scripts'].append('qa-android.js')
            (source / 'manifest.json').write_text(json.dumps(manifest))
            base = f'http://10.0.2.2:{server.server_port}'
            probe = (ROOT / 'tests/android-probe.js').read_text().replace('__NAVEGA_ANDROID_BASE__', json.dumps(base)).replace('__NAVEGA_ANDROID_RESULT__', json.dumps(base+'/result/'+token))
            (source / 'qa-android.js').write_text(probe)
            # Fenix needs a normal tab/session for temporary extension loading.
            adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', base+'/warmup', '-p', 'org.mozilla.firefox')
            time.sleep(2)
            command = [os.environ['NAVEGA_WEB_EXT'], 'run', '-t', 'firefox-android', '-s', str(source), '--adb-device', 'emulator-5554', '--firefox-apk', 'org.mozilla.firefox', '--no-reload', '--no-input', '--adb-discovery-timeout', '90000', '--verbose']
            with (temp / 'web-ext.log').open('w') as log:
                process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
                limit = time.monotonic() + 240
                while not done.wait(1) and time.monotonic() < limit:
                    if process.poll() is not None:
                        break
                if not done.is_set():
                    print((temp / 'web-ext.log').read_text()[-7000:], flush=True)
                    lines = adb('logcat', '-d', '-t', '3000').splitlines()
                    print('\n'.join(line for line in lines if any(word in line for word in ('WebExtension', 'Navega', 'Gecko', 'mozilla.firefox', 'AndroidRuntime'))) [-8000:], flush=True)
                    raise AssertionError('Native Android test did not report a result')
                print('NATIVE_ANDROID_RESULT', json.dumps(result), flush=True)
                assert result.get('ok'), result
    finally:
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        try:
            adb('shell', 'am', 'clear-debug-app', timeout=10)
            adb('shell', 'rm', '-f', '/data/local/tmp/org.mozilla.firefox-geckoview-config.yaml', timeout=10)
        except (subprocess.SubprocessError, OSError):
            pass
        server.shutdown()


if __name__ == '__main__':
    main()
