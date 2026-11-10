"""Browser integration checks: python3 tests/smoke.py (requires Python Playwright and Chromium)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import re
import unittest

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class RelayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/game.html'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.contexts = []
        self.errors = []
        self.external = []

    def tearDown(self):
        for context in self.contexts:
            context.close()
        self.assertEqual(self.errors, [], 'Uncaught JavaScript errors')

    def page(self, role='operator'):
        context = self.browser.new_context()
        self.contexts.append(context)
        page = context.new_page()
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.on('request', lambda request: self.external.append(request.url) if not request.url.startswith('http://127.0.0.1:') else None)
        page.goto(self.url)
        page.select_option('#role', role)
        return page

    def join_manual(self, page, seed):
        page.fill('#import-code', f'ATOM1-M-{seed}')
        page.click('#join-button')
        page.click('#start')
        expect(page.locator('#worm-game')).to_be_visible()

    def test_full_relay_and_local_independence(self):
        operator = self.page()
        expect(operator.locator('#join')).to_be_hidden()
        operator.select_option('#mode', 'M')
        operator.click('#create-button')
        seed = operator.input_value('#code')
        self.assertRegex(seed, r'^ATOM1-M-[a-f0-9]{12}$')
        operator.click('#start')
        worm = self.page('worm')
        expect(worm.locator('#create')).to_be_hidden()
        worm.fill('#import-code', seed)
        worm.click('#join-button')
        worm.click('#start')
        expect(worm.locator('#marking')).to_be_hidden()
        expect(worm.locator('#cross')).to_be_hidden()
        worm.click('#inspect')
        observation = worm.inner_text('#observation')
        symbol = next(str(i) for i, label in enumerate(worm.locator('#belly option').all_text_contents()) if label in observation)
        gesture = next(str(i) for i, label in enumerate(worm.locator('#gesture option').all_text_contents()) if label.lower() in observation)
        operator.select_option('#belly', symbol)
        operator.select_option('#gesture', gesture)
        operator.locator('#lookup-form button').click()
        advice = operator.inner_text('#lookup-result')
        materials = worm.locator('#bedding option').all_text_contents()
        correct = next(str(i) for i, label in enumerate(materials) if label.lower() in advice)
        # A bad instruction is recoverable, and cannot expose the next clue.
        worm.select_option('#bedding', str((int(correct) + 1) % 3))
        worm.locator('#bedding-form button').click()
        expect(worm.locator('#game-message')).to_contain_text('остался в проходе')
        expect(worm.locator('#marking')).to_be_hidden()
        # Each role has useful local work while talking.
        for _ in range(3):
            worm.click('#gather')
            operator.click('#assemble')
        expect(worm.locator('#gather')).to_be_disabled()
        operator_before = operator.inner_text('#operator-game')
        worm.select_option('#bedding', correct)
        worm.locator('#bedding-form button').click()
        expect(worm.locator('#marking')).to_be_hidden()
        worm.click('#cross')
        worm.click('#eat')
        expect(worm.locator('#food-status')).to_contain_text('восстановил силы')
        self.assertEqual(operator_before, operator.inner_text('#operator-game'), 'Worm actions must not update operator automatically')
        marking = worm.inner_text('#marking')
        cable = next(str(i) for i, label in enumerate(operator.locator('#connector option').all_text_contents()) if label in marking)
        operator.select_option('#connector', str((int(cable) + 1) % 3))
        operator.locator('#connect-form button').click()
        expect(operator.locator('#instrument')).to_be_hidden()
        expect(operator.locator('#connect-result')).to_contain_text('не подходит')
        operator.select_option('#connector', cable)
        operator.locator('#connect-form button').click()
        expect(operator.locator('#instrument')).to_be_visible()
        expect(operator.locator('#next-clue')).to_contain_text('гриб')
        expect(operator.locator('#game-message')).to_contain_text('следующая поляна пока не реализована')
        self.assertEqual(self.external, [], 'Manual game must work without outbound requests')
        # New attempt must reset progress on each independent client.
        worm.click('#stop')
        worm.fill('#import-code', seed)
        worm.click('#join-button')
        worm.click('#start')
        expect(worm.locator('#marking')).to_be_hidden()
        expect(worm.locator('#crumbs')).to_have_text('Крошки: 0 / 3')
        operator.click('#stop')
        operator.click('#create-button')
        operator.click('#start')
        expect(operator.locator('#instrument')).to_be_hidden()
        expect(operator.locator('#assembly-status')).to_have_text('Подготовлено: 0 / 3')

    def test_seed_reproducibility_and_variation(self):
        observations = []
        for seed in ['000000000000', '111111111111', 'abcdef012345']:
            first = self.page('worm')
            second = self.page('worm')
            for page in [first, second]:
                self.join_manual(page, seed)
                page.click('#inspect')
            self.assertEqual(first.inner_text('#observation'), second.inner_text('#observation'))
            observations.append(first.inner_text('#observation'))
        self.assertGreater(len(set(observations)), 1)

    def test_invalid_expired_seed_and_role_change(self):
        worm = self.page('worm')
        for seed in ['SYNC1-M-abcdef012345', 'ATOM1-M-abcdef012345-123', 'ATOM1-S-abcdef012345-1', 'ATOM1-U-abcdef012345']:
            worm.fill('#import-code', seed)
            worm.click('#join-button')
            expect(worm.locator('#status')).to_have_attribute('data-error', '')
            expect(worm.locator('#counter-view')).to_be_hidden()
        worm.fill('#import-code', 'ATOM1-M-abcdef012345')
        worm.click('#join-button')
        worm.select_option('#role', 'operator')
        expect(worm.locator('#session')).to_be_hidden()
        expect(worm.locator('#create')).to_be_visible()
        expect(worm.locator('#join')).to_be_hidden()

    def test_system_start(self):
        operator = self.page()
        operator.select_option('#mode', 'S')
        operator.locator('#delay').fill('10')
        operator.click('#create-button')
        seed = operator.input_value('#code')
        worm = self.page('worm')
        worm.fill('#import-code', seed)
        worm.click('#join-button')
        for page, role in [(operator, 'operator'), (worm, 'worm')]:
            expect(page.locator('#counter-view')).to_be_visible(timeout=15000)
            expect(page.locator(f'#{role}-game')).to_be_visible()
        self.assertEqual(self.external, [])

    def test_utc_start_mocked_and_failure(self):
        operator = self.page()
        expect(operator.locator('#mode')).to_have_value('U')
        operator.route('https://utctime.app/**', lambda route: route.fulfill(json={'unix_ms': __import__('time').time_ns() // 1000000}, headers={'access-control-allow-origin': '*'}))
        operator.locator('#delay').fill('10')
        operator.click('#create-button')
        expect(operator.locator('#code')).to_have_value(re.compile(r'ATOM1-U-[a-f0-9]{12}-[0-9]+'))
        expect(operator.locator('#operator-game')).to_be_visible(timeout=15000)
        operator.click('#stop')
        operator.unroute('https://utctime.app/**')
        operator.route('https://utctime.app/**', lambda route: route.abort())
        operator.click('#create-button')
        expect(operator.locator('#status')).to_have_attribute('data-error', '', timeout=15000)
        expect(operator.locator('#counter-view')).to_be_hidden()
        expect(operator.locator('#mode')).to_have_value('U')

if __name__ == '__main__':
    unittest.main(verbosity=2)
