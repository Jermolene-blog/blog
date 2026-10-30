import os
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1180,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file://'+os.getcwd()+'/quizbuzz-standalone.html')
        await pg.wait_for_timeout(100)
        await pg.click('button[data-set="bots"][data-val="false"]')
        await pg.wait_for_timeout(300)
        for i in range(4):
            await pg.evaluate(f"Join.i={i};joinShow()"); await pg.wait_for_timeout(3000)
            await (await pg.query_selector('#stageFit')).screenshot(path=f'join-{i}.png')
        # human joins on pad 1, then pad 2 joins; check pad 1 slide persists
        await pg.click('#pads .padcell:nth-child(1) .go'); await pg.wait_for_timeout(500)
        await pg.click('#pads .padcell:nth-child(1) [data-tut="next"]'); await pg.wait_for_timeout(400)
        k1=await pg.evaluate("document.querySelector('#pads .padcell:nth-child(1) .pad').dataset.key")
        await pg.click('#pads .padcell:nth-child(2) .go'); await pg.wait_for_timeout(500)
        k2=await pg.evaluate("document.querySelector('#pads .padcell:nth-child(1) .pad').dataset.key")
        print('key kept across join:',k1,k2)
        for n in range(3,6): await pg.click(f'#pads .padcell:nth-child({n}) .go'); await pg.wait_for_timeout(200)
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path='join-full.png',full_page=True)
        # pad 1: click through to ready
        for _ in range(10):
            btn=await pg.query_selector('#pads .padcell:nth-child(1) [data-tut="next"]')
            if not btn: break
            await btn.click(); await pg.wait_for_timeout(150)
        await pg.wait_for_timeout(2500)
        await (await pg.query_selector('#pads .padcell:nth-child(1)')).screenshot(path='pad-last.png')
        await pg.click('#pads .padcell:nth-child(1) [data-tut="ready"]'); await pg.wait_for_timeout(300)
        await pg.click('#pads .padcell:nth-child(2) [data-tut="next"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='join-full2.png',full_page=True)
        print('ready',await pg.evaluate("H.players.map(p=>p.name+':'+p.ready).join(' ')"),'errors',errs)
        await b.close()
asyncio.run(main())
