import asyncio
from playwright.async_api import async_playwright
U='http://127.0.0.1:8765/quizbuzz-standalone.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1180,'height':820})
        errs=[]
        def watch(pg,n):
            pg.on('pageerror',lambda e:errs.append(n+': '+str(e))); pg.on('console',lambda m:errs.append(n+': '+m.text) if m.type=='error' else None)
        host=await ctx.new_page(); watch(host,'host'); await host.goto(U+'?speed=4#host'); await host.wait_for_timeout(800)
        phones=[]
        for i,name in enumerate(['Ann','Bob','Cat']):
            pg=await ctx.new_page(); watch(pg,name); await pg.set_viewport_size({'width':390,'height':780})
            await pg.goto(U+'#pad'); await pg.wait_for_timeout(600)
            await pg.fill('input',name); await pg.click('.go'); await pg.wait_for_timeout(400)
            phones.append(pg)
        tod=await ctx.new_page(); watch(tod,'tod'); await tod.set_viewport_size({'width':390,'height':780}); await tod.goto(U+'#toddler'); await tod.wait_for_timeout(800)
        await host.screenshot(path='m-host-lobby.png')
        await phones[0].screenshot(path='m-phone-tut.png')
        print('players',await host.evaluate("H.players.map(p=>p.name).join(',')"))
        # phones mark ready by clicking through
        for pg in phones:
            for _ in range(12):
                n=await pg.query_selector('[data-tut="next"]')
                if not n: break
                await n.click(); await pg.wait_for_timeout(60)
            r=await pg.query_selector('[data-tut="ready"]')
            if r: await r.click()
        await host.wait_for_timeout(600)
        print('ready',await host.evaluate("H.players.map(p=>p.ready).join(',')"))
        await host.click('#bStart')
        # play: phones answer randomly, bet, choose; toddler attacks
        import random
        for t in range(500):
            for pg in phones:
                for sel in ['.ab:not([disabled])','.betb','.tgt']:
                    els=await pg.query_selector_all(sel)
                    if els and random.random()<.3:
                        try: await random.choice(els).click(timeout=300)
                        except Exception: pass
                        break
            if t%25==10:
                el=await tod.query_selector('.tgt2:not([disabled])')
                if el:
                    try: await el.click(timeout=300)
                    except Exception: pass
            ph=await host.evaluate("H.phase+'/'+((round()||{}).id||'')")
            if t==30: await host.screenshot(path='m-host-q.png'); await phones[1].screenshot(path='m-phone-q.png'); await tod.screenshot(path='m-tod.png')
            if ph.startswith('final'): break
            await host.wait_for_timeout(200)
        print('end',await host.evaluate("H.phase"),await host.evaluate("H.players.map(p=>p.name+':'+p.score).join(' ')"))
        # reload a phone mid-session: should rejoin as same player
        await phones[2].reload(); await phones[2].wait_for_timeout(1200)
        print('rejoin view',await phones[2].evaluate("document.querySelector('.top .n')&&document.querySelector('.top .n').textContent"))
        await phones[2].screenshot(path='m-phone-final.png')
        print('errors',errs[:10])
        await b.close()
asyncio.run(main())
