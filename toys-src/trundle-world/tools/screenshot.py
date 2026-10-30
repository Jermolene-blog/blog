#!/usr/bin/env python3
"""Headless screenshots of Trundle World for visual checks.

Usage:
  python3 tools/screenshot.py index.html                 # every size at 1100x750 plus a phone view
  python3 tools/screenshot.py index.html --sizes S M     # just some sizes
  python3 tools/screenshot.py index.html --fly           # also capture mid-flight and after landing

Needs: pip install playwright (Chromium installed via `playwright install chromium`
or an existing Chromium on PLAYWRIGHT_BROWSERS_PATH) and `npm install` for three@0.147.0.
three.js is served from node_modules, so no network is needed. Software WebGL
(SwiftShader) runs at only a few fps, and the sim caps dt at 0.05s, so simulated
time runs ~4-5x slower than wall time; the waits below allow for that.
Writes PNGs into ./shots/ and prints console errors and page errors.
"""
import argparse, asyncio, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
THREE = os.path.join(HERE, '..', 'node_modules', 'three')

async def open_page(browser, path, w, h, logs):
    pg = await browser.new_page(viewport={'width': w, 'height': h})
    # ignore the font requests we deliberately block below
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    async def route(r):
        u = r.request.url
        if 'three@0.147.0/' in u:
            await r.fulfill(path=os.path.join(THREE, u.split('three@0.147.0/')[1]), content_type='application/javascript')
        else:
            await r.abort()   # fonts etc: fall back to system fonts
    await pg.route('**/*', lambda r: route(r) if ('jsdelivr' in r.request.url or 'fonts.g' in r.request.url) else r.continue_())
    await pg.goto('file://' + os.path.abspath(path))
    return pg

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--sizes', nargs='*', default=['S', 'M', 'L', 'XL'])
    ap.add_argument('--fly', action='store_true')
    a = ap.parse_args()
    os.makedirs('shots', exist_ok=True)
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        pg = await open_page(b, a.html, 1100, 750, logs)
        await pg.wait_for_timeout(6000)
        for k in a.sizes:
            await pg.click(f'#size{k}')
            await pg.wait_for_timeout(16000 if k == 'XL' else 10000)
            await pg.screenshot(path=f'shots/{k}.png')
            print('wrote', f'shots/{k}.png')
            if a.fly:
                await pg.click('#bFly'); await pg.wait_for_timeout(5000)
                await pg.screenshot(path=f'shots/{k}_fly.png')
                await pg.wait_for_timeout(12000)
                await pg.screenshot(path=f'shots/{k}_landed.png')
        await pg.close()
        # phone: popups instead of the docked Watch list and separate add buttons
        pn = await open_page(b, a.html, 400, 820, logs)
        await pn.wait_for_timeout(6000)
        await pn.click('#bAddMenu'); await pn.wait_for_timeout(600)
        await pn.screenshot(path='shots/phone_add.png')
        await pn.click('#bFollow'); await pn.wait_for_timeout(600)
        await pn.screenshot(path='shots/phone_watch.png')
        print('wrote shots/phone_add.png shots/phone_watch.png')
        await b.close()
    if logs:
        print('\n'.join(logs)); sys.exit(1)

asyncio.run(main())
