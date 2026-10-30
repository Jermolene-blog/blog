"""Headless render check for flowing-field.html (software GL, so timings are meaningless; output is not).
Usage: python3 tools/render.py OUT.png [--slow] [--explore] [--random] [--debug] [--size 640x480]
Strokes three horizontal drags, then captures the canvas via the page's test hook (window.__sumi.snap).
Page errors (shader compile/link failures included) are printed."""
import asyncio, os, sys, math, base64
from playwright.async_api import async_playwright
a = sys.argv[1:]; out = a[0]
w, h = map(int, (a[a.index('--size')+1] if '--size' in a else '640x480').split('x'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":w,"height":h}, reduced_motion="reduce")
        pg.on("pageerror", lambda e: print("PAGE ERROR:", e))
        pg.on("console", lambda m: m.type=="error" and print("console:", m.text))
        await pg.route("**fonts.googleapis.com**", lambda r: r.abort())
        html = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "flowing-field.html")
        await pg.goto("file://"+os.path.abspath(html)+("#slow" if "--slow" in a else ""))
        await pg.wait_for_timeout(3000)
        await pg.keyboard.press("d" if "--debug" in a else "h")
        print("fast path:", await pg.evaluate("window.__sumi.fast"))
        if "--random" in a: await pg.evaluate("document.getElementById('bRand').click()")
        for y0 in (h*.3, h*.5, h*.7):
            await pg.mouse.move(40, y0); await pg.mouse.down()
            for i in range(14): await pg.mouse.move(40+i*(w-80)/13, y0+30*math.sin(i/2)); await pg.wait_for_timeout(5)
            await pg.mouse.up()
        if "--explore" in a: await pg.keyboard.press("e"); await pg.wait_for_timeout(4000)
        await pg.wait_for_timeout(1500)
        if "--debug" in a:
            await pg.evaluate("__sumi.halt()"); await pg.wait_for_timeout(1500); await pg.locator('#dbg').screenshot(path=out)
        else:
            u = await pg.evaluate("__sumi.snap()"); open(out,"wb").write(base64.b64decode(u.split(",")[1]))
        print("frames:", await pg.evaluate("__sumi.frames()"), "->", out)
        await b.close()
asyncio.run(main())
