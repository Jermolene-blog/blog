import os
import asyncio, sys
from playwright.async_api import async_playwright
W=int(sys.argv[1]) if len(sys.argv)>1 else 1180; L=sys.argv[2] if len(sys.argv)>2 else '2'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':W,'height':900})
        errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file://'+os.getcwd()+'/quizbuzz-standalone.html?speed=6')
        await pg.wait_for_timeout(600)
        await pg.click(f'button[data-set="length"][data-val="{L}"]'); await pg.wait_for_timeout(300)
        await pg.click('#pads .padcell:nth-child(1) [data-set], #pads .padcell:nth-child(1) .padcap button')  # make pad1 a robot
        await pg.wait_for_timeout(1500)
        print('lineup',await pg.evaluate("H.lineup.join(',')"))
        await pg.click('#bStart')
        seen={}; t=0; hits=0
        while t<4000:
            st=await pg.evaluate("H.phase+'/'+((round()||{}).id||'')")
            if st not in seen:
                seen[st]=1; await pg.wait_for_timeout(350)
                await (await pg.query_selector('#stageFit')).screenshot(path=f'f-{st.replace("/","-")}.png')
                if st in ('bet/wager','q/lives','q/wager'): await pg.screenshot(path=f'ff-{st.replace("/","-")}.png',full_page=True)
            # toddler attacks every so often
            if t%40==20:
                btn=await pg.query_selector('#pads .pad.toddler .tgt2:not([disabled])')
                if btn:
                    try: await btn.click(timeout=500); hits+=1
                    except Exception: pass
                    await pg.wait_for_timeout(500)
                    await (await pg.query_selector('#stageFit')).screenshot(path=f'tod-{hits}.png')
                    await pg.screenshot(path=f'todf-{hits}.png',full_page=True)
            if st.startswith('final'): break
            await pg.wait_for_timeout(150); t+=1
        await pg.wait_for_timeout(800)
        await (await pg.query_selector('#stageFit')).screenshot(path='f-final.png')
        print('phases',sorted(seen)); print('toddler hits',hits)
        print('scores',await pg.evaluate("H.players.map(p=>p.name+':'+p.score).join(' ')"))
        print('errors',errs[:12])
        await b.close()
asyncio.run(main())
