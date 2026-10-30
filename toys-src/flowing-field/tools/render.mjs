/*
Headless render check for Flowing Field (software GL, so timings are meaningless; output is not).
Usage: node tools/render.mjs OUT.png [--slow] [--explore] [--random] [--debug] [--size 640x480]
Strokes three horizontal drags, then captures the canvas via the page's test hook (window.__sumi.snap).
Page errors (shader compile/link failures included) are printed.
Needs Playwright from toys-src (cd toys-src && npm install).
*/
import {chromium} from "playwright";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const args = process.argv.slice(2), out = args[0], has = flag => args.includes(flag);
const [w,h] = (has("--size") ? args[args.indexOf("--size") + 1] : "640x480").split("x").map(Number);
const html = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../static-assets/toys/flowing-field/index.html");

const browser = await chromium.launch({args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page = await browser.newPage({viewport: {width: w,height: h},reducedMotion: "reduce"});
page.on("pageerror",e => console.log("PAGE ERROR:",e.message));
page.on("console",m => m.type() === "error" && console.log("console:",m.text()));
await page.route("**/fonts.googleapis.com/**",r => r.abort());
await page.goto("file://" + html + (has("--slow") ? "#slow" : ""));
await page.waitForTimeout(3000);
await page.keyboard.press(has("--debug") ? "d" : "h");
console.log("fast path:",await page.evaluate("window.__sumi.fast"));
if(has("--random")) await page.evaluate("document.getElementById('bRand').click()");
for(const y0 of [h * .3,h * .5,h * .7]) {
	await page.mouse.move(40,y0);
	await page.mouse.down();
	for(let i = 0; i < 14; i++) {
		await page.mouse.move(40 + i * (w - 80) / 13,y0 + 30 * Math.sin(i / 2));
		await page.waitForTimeout(5);
	}
	await page.mouse.up();
}
if(has("--explore")) {
	await page.keyboard.press("e");
	await page.waitForTimeout(4000);
}
await page.waitForTimeout(1500);
if(has("--debug")) {
	await page.evaluate("__sumi.halt()");
	await page.waitForTimeout(1500);
	await page.locator("#dbg").screenshot({path: out});
} else {
	const url = await page.evaluate("__sumi.snap()");
	fs.writeFileSync(out,Buffer.from(url.split(",")[1],"base64"));
}
console.log("frames:",await page.evaluate("__sumi.frames()"),"->",out);
await browser.close();
