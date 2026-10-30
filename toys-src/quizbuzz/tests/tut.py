import os
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1180,'height':820})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file://'+os.getcwd()+'/quizbuzz-standalone.html'); await pg.wait_for_timeout(1500)
        n=await pg.evaluate("tutSlides().length")
        for i in range(n):
            await pg.evaluate(f"Tut.i={i};tutShow()"); await pg.wait_for_timeout(6200)
            await (await pg.query_selector('#stageFit')).screenshot(path=f'tut-{i}.png')
        await pg.click('#stage'); await pg.wait_for_timeout(300)
        print(n,'slides; idx after click',await pg.evaluate("Tut.i"),'errors',errs)
        await b.close()
asyncio.run(main())
