"""Real WebRTC joining between separate browser processes (host iPad + phones).
The host camera is bypassed: each phone's reply code is handed to the host as if scanned."""
import asyncio, os
from playwright.async_api import async_playwright
U='http://127.0.0.1:8766/quizbuzz-standalone.html'
ARGS=['--disable-features=WebRtcHideLocalIpsWithMdns','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']
async def main():
    async with async_playwright() as p:
        errs=[]
        def watch(pg,n):
            pg.on('pageerror',lambda e:errs.append(n+': '+str(e))); pg.on('console',lambda m:errs.append(n+': '+m.text) if m.type=='error' else None)
        hb=await p.chromium.launch(args=ARGS); hctx=await hb.new_context(viewport={'width':1180,'height':820},permissions=['camera'])
        host=await hctx.new_page(); watch(host,'host'); await host.goto(U+'?speed=4#host')
        await host.wait_for_function("net.rtc&&net.rtc.joinURL",timeout=15000)
        await host.wait_for_timeout(500); await host.screenshot(path='lan-host-lobby.png')
        browsers=[];phones=[]
        for i,name in enumerate(['Ann','Bob','Tod']):
            b=await p.chromium.launch(args=ARGS); ctx=await b.new_context(viewport={'width':390,'height':780},permissions=['camera']); browsers.append(b)
            pg=await ctx.new_page(); watch(pg,name)
            url=await host.evaluate("net.rtc.joinURL")
            await pg.goto(url.replace('http://127.0.0.1:8766/', 'http://127.0.0.1:8766/').replace('?speed=4',''))
            await pg.wait_for_timeout(300)
            await pg.click('[data-rtc="tod"]' if name=='Tod' else '[data-rtc="player"]')
            await pg.wait_for_function("window.__soloPad.link.g&&window.__soloPad.link.g.reply",timeout=15000)
            if i==0: await pg.screenshot(path='lan-phone-reply.png')
            code=await pg.evaluate("window.__soloPad.link.g.reply")
            await host.evaluate("c=>net.rtc.acceptReply(c)",code)
            if name!='Tod':
                await pg.wait_for_selector('.go',timeout=15000)
                await pg.fill('input',name); await pg.click('.go')
            else:
                await pg.wait_for_selector('.pad.toddler',timeout=15000)
            await host.wait_for_function(f"net.rtc.joinURL&&net.rtc.joinURL!=={code!r}",timeout=15000)
            phones.append(pg)
        await host.wait_for_timeout(800)
        print('players',await host.evaluate("H.players.map(p=>p.name).join(',')"))
        await host.screenshot(path='lan-host-joined.png'); await phones[0].screenshot(path='lan-phone-tut.png')
        await host.click('#bStart')
        import random
        for t in range(400):
            for pg in phones[:2]:
                for sel in ['.ab:not([disabled])','.betb','.tgt']:
                    els=await pg.query_selector_all(sel)
                    if els and random.random()<.35:
                        try: await random.choice(els).click(timeout=300)
                        except Exception: pass
                        break
            if t%30==15:
                el=await phones[2].query_selector('.tgt2:not([disabled])')
                if el:
                    try: await el.click(timeout=300)
                    except Exception: pass
            if t==40: await host.screenshot(path='lan-host-q.png'); await phones[1].screenshot(path='lan-phone-q.png')
            if t==60:
                # Bob's phone drops off and rejoins with a fresh scan
                await host.click('#bJoinCode'); await host.wait_for_timeout(300); await host.screenshot(path='lan-host-joinov.png')
                await phones[1].reload(); await phones[1].wait_for_timeout(500)
                url=await host.evaluate("net.rtc.joinURL")
                await phones[1].goto(url); await phones[1].wait_for_timeout(1500); await phones[1].click('[data-rtc="player"]')
                await phones[1].wait_for_function("window.__soloPad.link.g&&window.__soloPad.link.g.reply",timeout=15000)
                await host.evaluate("c=>net.rtc.acceptReply(c)",await phones[1].evaluate("window.__soloPad.link.g.reply"))
                await phones[1].wait_for_timeout(1500)
                print('Bob after rejoin sees:',await phones[1].evaluate("document.querySelector('.top .n')?.textContent"), '| players',await host.evaluate("H.players.length"))
                await host.click('#bJoinCode')
            ph=await host.evaluate("H.phase")
            if ph=='final': break
            await host.wait_for_timeout(200)
        print('end',await host.evaluate("H.phase+' '+H.players.map(p=>p.name+':'+p.score).join(' ')"))
        print('errors',errs[:10])
        for b in browsers: await b.close()
        await hb.close()
asyncio.run(main())
