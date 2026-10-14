"""Install the exact Firefox build temporarily in an isolated WebDriver profile.

The CI runner maps fixture hostnames to this local HTTP server. No real site,
account, ad destination or user browser/profile is used by these tests.
"""
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
import tempfile
import threading
import time
import zipfile
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
BUILD = Path(os.environ.get('NAVEGA_EXTENSION_DIR', ROOT.parent / 'dist/firefox')).resolve()
HTML = (ROOT / 'tests/fixtures/sites.html').read_text()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = '<p id="normal">Link normal aberto</p>' if self.path.startswith('/normal') else '<p>Iframe normal</p>' if self.path.startswith('/frame') else HTML.replace('__PORT__', str(self.server.server_port))
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args):
        pass


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    options = webdriver.FirefoxOptions()
    options.add_argument('-headless')
    options.set_preference('network.trr.mode', 5)  # Local fixture DNS, not public DoH.
    options.set_preference('dom.security.https_first', False)
    options.set_preference('dom.security.https_only_mode', False)
    driver = None
    try:
        with tempfile.TemporaryDirectory(prefix='navega-firefox-') as temp:
            package = Path(temp) / 'extension.zip'
            with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED) as archive:
                for p in sorted(BUILD.rglob('*')):
                    if p.is_file(): archive.write(p, p.relative_to(BUILD))
            driver = webdriver.Firefox(options=options)
            driver.set_page_load_timeout(30)
            print('FIREFOX', driver.capabilities['browserVersion'], flush=True)
            addon = driver.install_addon(str(package), temporary=True)
            assert addon == 'navega-livre@local.extension'
            wait = WebDriverWait(driver, 12)
            for host in ('reader.navega.test', 'news.navega.test', 'video.navega.test'):
                driver.get(f'http://{host}:{server.server_port}/')
                wait.until(lambda d: d.execute_script('return typeof window.__navegaLivrePopupState === "function" && __navegaLivrePopupState().enabled'))
                wait.until(lambda d: not d.find_element(By.ID, 'floating').is_displayed())
                assert driver.find_element(By.ID, 'reader').is_displayed()
                assert driver.find_element(By.ID, 'header').is_displayed()
                assert driver.find_element(By.ID, 'normalframe').is_displayed()
                assert not driver.find_element(By.ID, 'adframe').is_displayed()
                wait.until(lambda d: d.execute_script('return window.automaticResult === null'))
                for name in ('hijack', 'background', 'known-ad'):
                    before = set(driver.window_handles)
                    driver.find_element(By.ID, name).click()
                    assert driver.execute_script('return window.attackResult === null')
                    assert set(driver.window_handles) == before
                driver.find_element(By.ID, 'bait').click()
                assert driver.execute_script('return window.baitResult === false')
                driver.find_element(By.ID, 'insert').click()
                wait.until(lambda d: not d.find_element(By.ID, 'dynamic').is_displayed())
                driver.find_element(By.ID, 'search').send_keys('capítulo')
                assert driver.find_element(By.ID, 'search').get_attribute('value') == 'capítulo'
                origin = driver.current_window_handle
                before = set(driver.window_handles)
                driver.find_element(By.ID, 'normal-link').click()
                wait.until(lambda d: len(d.window_handles) == len(before) + 1)
                new = (set(driver.window_handles) - before).pop()
                driver.switch_to.window(new)
                wait.until(lambda d: d.find_element(By.ID, 'normal').is_displayed())
                driver.close()
                driver.switch_to.window(origin)
                before = set(driver.window_handles)
                driver.find_element(By.ID, 'share').click()
                wait.until(lambda d: len(d.window_handles) == len(before) + 1)
                new = (set(driver.window_handles) - before).pop()
                driver.switch_to.window(new)
                driver.close()
                driver.switch_to.window(origin)
                print('PASS', host, 'floaters, banners, dynamic ads, frames, hijacked clicks, normal links/buttons and install bait', flush=True)
            print('ALL MULTISITE FIREFOX TESTS PASSED', flush=True)
    finally:
        if driver: driver.quit()
        server.shutdown()


if __name__ == '__main__':
    main()
