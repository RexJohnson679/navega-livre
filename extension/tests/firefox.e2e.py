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
from selenium.webdriver.firefox.service import Service

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
    options.set_preference('devtools.console.stdout.content', True)
    driver = None
    try:
        with tempfile.TemporaryDirectory(prefix='navega-firefox-') as temp:
            package = Path(temp) / 'extension.zip'
            with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED) as archive:
                for p in sorted(BUILD.rglob('*')):
                    if p.is_file(): archive.write(p, p.relative_to(BUILD))
            gecko_log = Path(temp) / 'geckodriver.log'
            driver = webdriver.Firefox(options=options, service=Service(log_output=str(gecko_log)))
            driver.set_page_load_timeout(30)
            print('FIREFOX', driver.capabilities['browserVersion'], flush=True)
            addon = driver.install_addon(str(package), temporary=True)
            assert addon == 'navega-livre@local.extension'
            wait = WebDriverWait(driver, 12)
            # install_addon may return before asynchronous MV3 registration finishes.
            # Warm up on a harmless fixture, then start the actual page scenarios.
            driver.get(f'http://reader.navega.test:{server.server_port}/frame')
            time.sleep(1)
            for host in ('reader.navega.test', 'news.navega.test', 'video.navega.test'):
                driver.get(f'http://{host}:{server.server_port}/')
                print('PAGE STATE', host, driver.execute_script('return {url:location.origin,guard:typeof (window.wrappedJSObject || window).__navegaLivrePopupState,policy:typeof (window.wrappedJSObject || window).NavegaPopupPolicy,data:typeof (window.wrappedJSObject || window).NavegaBlockingData,ad:document.querySelector("#banner")?.getAttribute("data-navega-livre-hidden")}'), flush=True)
                try:
                    wait.until(lambda d: d.execute_script('const w=window.wrappedJSObject || window; return typeof w.__navegaLivrePopupState === "function" && w.__navegaLivrePopupState().enabled'))
                except Exception:
                    print('FIREFOX GUARD DEBUG', driver.execute_script('return {guard:typeof (window.wrappedJSObject || window).__navegaLivrePopupState,policy:typeof (window.wrappedJSObject || window).NavegaPopupPolicy,data:typeof (window.wrappedJSObject || window).NavegaBlockingData,hidden:document.querySelector("#banner")?.getAttribute("data-navega-livre-hidden")}'), flush=True)
                    if gecko_log.is_file():
                        print('\n'.join(line for line in gecko_log.read_text(errors='replace').splitlines() if 'Navega' in line or 'Error' in line)[-6000:], flush=True)
                    raise
                wait.until(lambda d: not d.find_element(By.ID, 'floating').is_displayed())
                assert driver.find_element(By.ID, 'reader').is_displayed()
                assert driver.find_element(By.ID, 'header').is_displayed()
                assert driver.find_element(By.ID, 'normalframe').is_displayed()
                assert not driver.find_element(By.ID, 'adframe').is_displayed()
                wait.until(lambda d: d.execute_script('return (window.wrappedJSObject || window).automaticResult === null'))
                for name in ('hijack', 'background', 'known-ad'):
                    before = set(driver.window_handles)
                    driver.find_element(By.ID, name).click()
                    assert driver.execute_script('return (window.wrappedJSObject || window).attackResult === null')
                    assert set(driver.window_handles) == before
                driver.find_element(By.ID, 'bait').click()
                assert driver.execute_script('return (window.wrappedJSObject || window).baitResult === false')
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
            driver.get(f'http://www.youtube.com:{server.server_port}/watch?v=fixture')
            wait.until(lambda d: d.execute_script('const w=window.wrappedJSObject || window; return typeof w.__navegaLivreYoutubeState === "function" && w.__navegaLivreYoutubeState().enabled && !Object.hasOwn(w.ytInitialPlayerResponse,"playerAds")'))
            assert driver.execute_script('const w=window.wrappedJSObject || window; return w.ytInitialPlayerResponse.videoDetails.videoId') == 'fixture'
            assert driver.execute_script('const w=window.wrappedJSObject || window; return w.ytInitialPlayerResponse.streamingData.url') == 'keep'
            print('PASS Firefox YouTube MAIN filtering and preservation of normal player metadata', flush=True)
            print('ALL MULTISITE FIREFOX TESTS PASSED', flush=True)
    finally:
        if driver: driver.quit()
        server.shutdown()


if __name__ == '__main__':
    main()
