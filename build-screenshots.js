/*
Capture screenshots of the toys and other interactive pages on the site, for
use as thumbnails in listings and posts.

Each target is a folder that is published verbatim: every toy in
`static-assets/toys`, plus the extra pages listed in `extraTargets`. The
screenshot of the page published at `/<path>/` is saved as
`static-assets/screenshots/<path>.webp`, and so is published at
`/screenshots/<path>.webp`.

Pages are loaded from a local web server into headless Google Chrome, driven
directly over the DevTools protocol so that there are no npm dependencies. A
page can be prepared before capture by a recipe in `recipes` below, for example
to draw something into an empty canvas.

Pages are rendered at twice the resolution of the screenshot, so that a target
listed in `closeups` below can also be captured as a sharp close-up of its most
interesting part, saved as `social/closeups/<path>.webp`. The close-ups are not
published themselves: `build-social.js` makes them into social media preview
cards.

Screenshots are committed to the repository. `screenshots.json` records a hash
of each target's files, recipe and close-up, and a target is only recaptured
when its hash changes, so a normal build does not need Chrome at all. If Chrome
cannot be found, stale screenshots are left alone with a warning rather than
failing the build.

Usage: node build-screenshots.js [--force] [<path>...]

  --force   recapture even if the hash is unchanged
  <path>    only consider the given targets, eg `toys/knottery`

Set CHROME_PATH to use a particular Chrome or Chromium executable.
*/

"use strict";

const fs = require("fs"),
	os = require("os"),
	path = require("path"),
	http = require("http"),
	crypto = require("crypto"),
	childProcess = require("child_process");

const rootDir = __dirname,
	staticDir = path.join(rootDir,"static-assets"),
	screenshotsDir = path.join(staticDir,"screenshots"),
	closeupsDir = path.join(rootDir,"social","closeups"),
	manifestFile = path.join(rootDir,"screenshots.json");

// Bump to force every screenshot to be recaptured
const CAPTURE_VERSION = 2;

const VIEWPORT = {width: 1200, height: 800},
	DEVICE_SCALE_FACTOR = 2,
	WEBP_QUALITY = 80,
	CLOSEUP_QUALITY = 90,
	SETTLE_DELAY = 1000,
	NAVIGATION_TIMEOUT = 30000;

// Pages published from somewhere other than static-assets/toys. `dir` is the
// folder that is served, and `source` the folder whose changes trigger a
// recapture (defaults to `dir`)
const extraTargets = [
	{path: "archive/cecily", dir: "static-assets/archive/cecily"},
	{path: "talkytalky", dir: "talkytalky-wiki/output", source: "talkytalky-wiki"}
];

// Preparation before capture, keyed by target path. A recipe is an async
// function called with a page object (see `openPage`). The recipe source is
// part of the target's hash, so editing a recipe triggers a recapture
const recipes = {
	"toys/knottery": async page => {
		// Draw a closed trefoil knot as a single stroke
		await page.click("#closePaths");
		const box = await page.evaluate(`(() => {
			const r = document.getElementById("stage").getBoundingClientRect();
			return {x: r.left, y: r.top, width: r.width, height: r.height};
		})()`);
		const cx = box.x + box.width / 2,
			cy = box.y + box.height / 2,
			scale = Math.min(box.width,box.height) / 7.5,
			points = [];
		for(let step = 0; step <= 240; step++) {
			const t = step / 240 * Math.PI * 2;
			points.push({
				x: cx + scale * (Math.sin(t) + 2 * Math.sin(2 * t)),
				y: cy + scale * (Math.cos(t) - 2 * Math.cos(2 * t))
			});
		}
		await page.drag(points);
	},
	"toys/jpegulator": async page => {
		await page.click("#samples2");
		await page.wait(2000);
	},
	"toys/lenticulator": async page => {
		await page.scrollTo("h2");
	},
	"toys/mimic": async page => {
		await page.click("button[onclick]");
	},
	"toys/catflap": async page => {
		// Let the cat in, and wait for it to settle under the shelf thinking of its dinner
		await page.click("#game");
		await page.wait(9000);
	},
	"toys/animal-island": async page => {
		// Press Start so that the island is shown instead of the start screen
		await page.click("#go");
		await page.wait(2000);
	},
	"toys/meadow-games": async page => {
		// Wait for the models to be decoded and the herd to settle behind the tiles
		await page.evaluate(`new Promise(resolve => { const check = () => window.__meadow ? resolve(true) : setTimeout(check,200); check(); })`);
		await page.wait(4000);
	},
	"toys/marble-flick": async page => {
		// Start a game so that the board is shown instead of the setup card
		await page.click("#startBtn");
		await page.wait(2000);
	},
	"toys/jumbleword": async page => {
		// Dismiss the opening card, let the balls drop into the rack, then
		// spell the longest word in the puzzle so that the card shows a word
		// found, and wait for the celebration to finish
		await page.click("#play");
		await page.wait(1500);
		const selectors = await page.evaluate(`(() => {
			const balls = [...document.querySelectorAll("#rack .ball")],
				letters = balls.map(ball => ball.textContent.trim().toLowerCase()),
				puzzles = JSON.parse(document.getElementById("pz").textContent)[letters.length],
				puzzle = puzzles.find(p => p.l === letters.slice().sort().join("")),
				word = puzzle.t.split(",").sort((a,b) => b.length - a.length)[0],
				spare = balls.slice();
			return [...word].map(ch => {
				const index = spare.findIndex(ball => ball && ball.textContent.trim().toLowerCase() === ch),
					id = spare[index].id;
				spare[index] = null;
				return "#" + id;
			});
		})()`);
		for(const selector of selectors) {
			await page.click(selector);
		}
		await page.click("#enter");
		await page.wait(4000);
	},
	"archive/cecily": async page => {
		// Let the zooming animations finish
		await page.wait(3000);
	},
	"talkytalky": async page => {
		await page.wait(2000);
	}
};

// The most interesting part of each target, captured after the screenshot as a
// close-up for its social media card. `clip` is a rectangle in CSS pixels in the
// 1200x800 page, square unless the subject is wide (a wide close-up gets a card
// with the picture across the top). A close-up can have its own recipe, run
// after the screenshot, to reach a view that the thumbnail doesn't show
const closeups = {
	"archive/cecily": {clip: {x: 120, y: 80, width: 640, height: 640}},
	"talkytalky": {clip: {x: 300, y: 320, width: 330, height: 330}},
	"toys/animal-island": {clip: {x: 300, y: 170, width: 520, height: 520}},
	"toys/bear-beat": {clip: {x: 390, y: 200, width: 420, height: 420}},
	"toys/blobbles": {clip: {x: 560, y: 100, width: 520, height: 520}},
	"toys/bowling-bear": {
		// Practise alone, to show the bear by the pins at the end of the lane
		recipe: async page => {
			await page.click("#bSolo");
			await page.wait(4000);
		},
		clip: {x: 440, y: 230, width: 420, height: 420}
	},
	"toys/catflap": {clip: {x: 560, y: 120, width: 580, height: 580}},
	"toys/engravery": {clip: {x: 170, y: 160, width: 580, height: 580}},
	"toys/fractaliser": {clip: {x: 330, y: 110, width: 500, height: 500}},
	"toys/jpegulator": {clip: {x: 330, y: 230, width: 560, height: 560}},
	"toys/jumbleword": {clip: {x: 10, y: 250, width: 540, height: 167}},
	"toys/knottery": {clip: {x: 300, y: 120, width: 600, height: 600}},
	"toys/lala-yala": {clip: {x: 345, y: 200, width: 560, height: 560}},
	"toys/lenticulator": {clip: {x: 33, y: 253, width: 1132, height: 314}},
	"toys/marble-flick": {clip: {x: 250, y: 180, width: 600, height: 600}},
	"toys/marblelous": {clip: {x: 560, y: 90, width: 570, height: 570}},
	"toys/meadow-games": {clip: {x: 180, y: 150, width: 620, height: 620}},
	"toys/mimic": {clip: {x: 30, y: 300, width: 500, height: 500}},
	"toys/over-underiser": {clip: {x: 290, y: 90, width: 620, height: 620}},
	"toys/quizbuzz": {clip: {x: 160, y: 0, width: 600, height: 600}},
	"toys/rug-addict": {clip: {x: 155, y: 250, width: 315, height: 315}},
	"toys/spotty-sphericle": {clip: {x: 110, y: 90, width: 590, height: 590}},
	"toys/sunthesis": {clip: {x: 140, y: 110, width: 580, height: 580}},
	"toys/trundle-world": {clip: {x: 300, y: 60, width: 640, height: 640}},
	"toys/tunerful": {clip: {x: 320, y: 50, width: 560, height: 560}},
	"toys/vectorious": {
		// The quantised bitmap beside the traced vector, further down the page
		recipe: async page => {
			await page.scrollTo("#bit");
		},
		selector: "#bit",
		clip: {x: -14, y: -40, width: 764, height: 200}
	}
};

function readManifest() {
	try {
		return JSON.parse(fs.readFileSync(manifestFile,"utf8"));
	} catch(e) {
		return {};
	}
}

function writeManifest(manifest) {
	const sorted = {};
	Object.keys(manifest).sort().forEach(key => sorted[key] = manifest[key]);
	fs.writeFileSync(manifestFile,JSON.stringify(sorted,null,"\t") + "\n","utf8");
}

// Folders in static-assets/toys without an index.html, such as `cat`, hold code
// shared between toys. A toy whose page refers to `../<folder>/` is recaptured
// when that folder changes too
function findTargets() {
	const toysDir = path.join(staticDir,"toys"),
		folders = fs.readdirSync(toysDir,{withFileTypes: true}).filter(entry => entry.isDirectory()).map(entry => entry.name),
		isToy = name => fs.existsSync(path.join(toysDir,name,"index.html")),
		shared = folders.filter(name => !isToy(name)),
		toys = folders.filter(isToy).map(name => {
			const html = fs.readFileSync(path.join(toysDir,name,"index.html"),"utf8");
			return {
				path: "toys/" + name,
				dir: path.join("static-assets","toys",name),
				shared: shared.filter(folder => html.includes("../" + folder + "/")).map(folder => path.join("static-assets","toys",folder))
			};
		});
	return toys.concat(extraTargets).map(target => Object.assign({
		source: target.dir,
		outputFile: path.join(screenshotsDir,target.path + ".webp"),
		closeupFile: closeups[target.path] ? path.join(closeupsDir,target.path + ".webp") : null
	},target));
}

// Hash the relative paths and contents of the files in a target's source
// folder, along with the recipe and capture settings. Files ignored by git
// are left out so that a fresh checkout computes the same hash
function hashTarget(target) {
	const hash = crypto.createHash("sha256");
	const closeup = closeups[target.path];
	hash.update(JSON.stringify({CAPTURE_VERSION, VIEWPORT, DEVICE_SCALE_FACTOR, WEBP_QUALITY, CLOSEUP_QUALITY,
		recipe: String(recipes[target.path] || ""),
		closeup: closeup ? {recipe: String(closeup.recipe || ""), selector: closeup.selector, clip: closeup.clip} : null}));
	hashFolder(hash,target.source,"");
	// Shared folders are named by their path relative to the toy, as the page refers to them
	(target.shared || []).forEach(folder => hashFolder(hash,folder,path.relative(target.source,folder) + "/"));
	return hash.digest("hex");
}

function hashFolder(hash,folder,prefix) {
	const sourceDir = path.join(rootDir,folder),
		listing = childProcess.execFileSync("git",["ls-files","-z","--cached","--others","--exclude-standard","--","."],{cwd: sourceDir, encoding: "utf8"}),
		files = Array.from(new Set(listing.split("\0").filter(Boolean))).sort();
	files.forEach(file => {
		const fullPath = path.join(sourceDir,file);
		// Deleted but not yet staged files are still listed
		if(fs.existsSync(fullPath)) {
			hash.update(prefix + file + "\0");
			hash.update(fs.readFileSync(fullPath));
			hash.update("\0");
		}
	});
}

function findChrome() {
	const candidates = [
		process.env.CHROME_PATH,
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
		"google-chrome-stable",
		"google-chrome",
		"chromium",
		"chromium-browser"
	].filter(Boolean);
	for(const candidate of candidates) {
		if(candidate.indexOf("/") !== -1) {
			if(fs.existsSync(candidate)) {
				return candidate;
			}
		} else {
			const result = childProcess.spawnSync("which",[candidate],{encoding: "utf8"});
			if(result.status === 0 && result.stdout.trim()) {
				return result.stdout.trim();
			}
		}
	}
	return null;
}

const mimeTypes = {
	".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".js": "text/javascript",
	".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
	".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".wasm": "application/wasm"
};

// Serve each target's folder at its published path, along with the shared
// folders that the toys load from
function startServer(targets) {
	const shared = Array.from(new Set(targets.flatMap(target => target.shared || []))).map(dir => ({
			path: path.relative(staticDir,path.join(rootDir,dir)).split(path.sep).join("/"),
			dir: dir
		})),
		served = targets.concat(shared);
	const server = http.createServer((request,response) => {
		const urlPath = decodeURIComponent(new URL(request.url,"http://localhost").pathname),
			target = served.find(target => urlPath === "/" + target.path || urlPath.startsWith("/" + target.path + "/"));
		if(!target) {
			response.writeHead(404);
			return response.end();
		}
		if(urlPath === "/" + target.path) {
			response.writeHead(301,{Location: urlPath + "/"});
			return response.end();
		}
		const baseDir = path.join(rootDir,target.dir);
		let filePath = path.join(baseDir,urlPath.slice(target.path.length + 2));
		if(!filePath.startsWith(baseDir)) {
			response.writeHead(403);
			return response.end();
		}
		if(fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
			filePath = path.join(filePath,"index.html");
		}
		fs.readFile(filePath,(err,data) => {
			if(err) {
				response.writeHead(404);
				return response.end();
			}
			response.writeHead(200,{"Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"});
			response.end(data);
		});
	});
	return new Promise(resolve => server.listen(0,"127.0.0.1",() => resolve(server)));
}

// Launch Chrome and connect to it over the DevTools protocol
async function launchChrome(executable) {
	const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(),"build-screenshots-")),
		args = [
			"--headless=new",
			"--remote-debugging-port=0",
			"--user-data-dir=" + userDataDir,
			"--no-first-run",
			"--no-default-browser-check",
			"--hide-scrollbars",
			"--mute-audio",
			"--force-color-profile=srgb",
			"about:blank"
		];
	// Chrome's sandbox is unavailable on some CI runners; we only load our own pages
	if(process.env.CI) {
		args.unshift("--no-sandbox");
	}
	const chrome = childProcess.spawn(executable,args,{stdio: ["ignore","ignore","pipe"]});
	const endpoint = await new Promise((resolve,reject) => {
		let stderr = "";
		const timer = setTimeout(() => reject(new Error("Timed out waiting for Chrome to start:\n" + stderr)),NAVIGATION_TIMEOUT);
		chrome.stderr.on("data",data => {
			stderr += data;
			const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
			if(match) {
				clearTimeout(timer);
				resolve(match[1]);
			}
		});
		chrome.on("exit",code => reject(new Error("Chrome exited with code " + code + ":\n" + stderr)));
	});
	const socket = new WebSocket(endpoint);
	await new Promise((resolve,reject) => {
		socket.addEventListener("open",resolve);
		socket.addEventListener("error",reject);
	});
	let nextId = 1;
	const pending = new Map(),
		listeners = new Set();
	socket.addEventListener("message",event => {
		const message = JSON.parse(event.data);
		if(message.id && pending.has(message.id)) {
			const {resolve,reject} = pending.get(message.id);
			pending.delete(message.id);
			if(message.error) {
				reject(new Error(message.error.message));
			} else {
				resolve(message.result);
			}
		} else if(message.method) {
			listeners.forEach(listener => listener(message));
		}
	});
	function send(method,params,sessionId) {
		const id = nextId++;
		socket.send(JSON.stringify({id, method, params: params || {}, sessionId}));
		return new Promise((resolve,reject) => pending.set(id,{resolve,reject}));
	}
	return {
		send,
		listeners,
		async close() {
			try {
				await send("Browser.close");
			} catch(e) {
				chrome.kill();
			}
			socket.close();
			await new Promise(resolve => chrome.exitCode !== null ? resolve() : chrome.on("exit",resolve));
			fs.rmSync(userDataDir,{recursive: true, force: true});
		}
	};
}

// Open a new tab and return an object with helpers for recipes
async function openPage(browser,viewport) {
	viewport = viewport || VIEWPORT;
	const {targetId} = await browser.send("Target.createTarget",{url: "about:blank"}),
		{sessionId} = await browser.send("Target.attachToTarget",{targetId, flatten: true}),
		send = (method,params) => browser.send(method,params,sessionId),
		wait = ms => new Promise(resolve => setTimeout(resolve,ms));
	function waitForEvent(method,timeout) {
		return new Promise((resolve,reject) => {
			const timer = setTimeout(() => {
				browser.listeners.delete(listener);
				reject(new Error("Timed out waiting for " + method));
			},timeout);
			function listener(message) {
				if(message.sessionId === sessionId && message.method === method) {
					clearTimeout(timer);
					browser.listeners.delete(listener);
					resolve(message.params);
				}
			}
			browser.listeners.add(listener);
		});
	}
	await send("Page.enable");
	await send("Emulation.setDeviceMetricsOverride",{width: viewport.width, height: viewport.height, deviceScaleFactor: DEVICE_SCALE_FACTOR, mobile: false});
	await send("Emulation.setEmulatedMedia",{features: [{name: "prefers-color-scheme", value: "light"}, {name: "prefers-reduced-motion", value: "no-preference"}]});
	const page = {
		wait,
		async evaluate(expression) {
			const result = await send("Runtime.evaluate",{expression, awaitPromise: true, returnByValue: true});
			if(result.exceptionDetails) {
				throw new Error("Error evaluating script: " + (result.exceptionDetails.exception ? result.exceptionDetails.exception.description : result.exceptionDetails.text));
			}
			return result.result.value;
		},
		async navigate(url) {
			const loaded = waitForEvent("Page.loadEventFired",NAVIGATION_TIMEOUT);
			await send("Page.navigate",{url});
			await loaded;
			await page.evaluate("document.fonts.ready.then(() => true)");
			await wait(SETTLE_DELAY);
		},
		// Click the centre of the first element matching a selector
		async click(selector) {
			const point = await page.evaluate(`(() => {
				const element = document.querySelector(${JSON.stringify(selector)});
				if(!element) return null;
				element.scrollIntoView({block: "nearest"});
				const r = element.getBoundingClientRect();
				return {x: r.left + r.width / 2, y: r.top + r.height / 2};
			})()`);
			if(!point) {
				throw new Error("No element matches " + selector);
			}
			await page.drag([point]);
			await wait(SETTLE_DELAY);
		},
		// Press the mouse at the first point, move through the rest and release
		async drag(points) {
			const first = points[0],
				last = points[points.length - 1];
			await send("Input.dispatchMouseEvent",{type: "mouseMoved", x: first.x, y: first.y});
			await send("Input.dispatchMouseEvent",{type: "mousePressed", x: first.x, y: first.y, button: "left", buttons: 1, clickCount: 1});
			for(const point of points.slice(1)) {
				await send("Input.dispatchMouseEvent",{type: "mouseMoved", x: point.x, y: point.y, button: "left", buttons: 1});
			}
			await send("Input.dispatchMouseEvent",{type: "mouseReleased", x: last.x, y: last.y, button: "left", buttons: 0, clickCount: 1});
		},
		async scrollTo(selector) {
			await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: "start"})`);
			await wait(SETTLE_DELAY);
		},
		// Capture a rectangle of the viewport in CSS pixels (the whole viewport by
		// default). The image has `scale` times the page's device pixels, so the
		// default of one pixel to each CSS pixel undoes the device pixel ratio
		async screenshot(options) {
			options = Object.assign({format: "webp", quality: WEBP_QUALITY, clip: {x: 0, y: 0, width: viewport.width, height: viewport.height}, scale: 1 / DEVICE_SCALE_FACTOR},options);
			// The clip is given to Chrome in page coordinates
			const scroll = await page.evaluate("({x: window.scrollX, y: window.scrollY})"),
				clip = Object.assign({},options.clip,{x: options.clip.x + scroll.x, y: options.clip.y + scroll.y, scale: options.scale}),
				{data} = await send("Page.captureScreenshot",{format: options.format, quality: options.quality, clip});
			return Buffer.from(data,"base64");
		},
		close() {
			return browser.send("Target.closeTarget",{targetId});
		}
	};
	return page;
}

// Capture a close-up at full resolution. A clip with a selector is relative to
// the top left corner of the element it matches
async function captureCloseup(page,closeup) {
	if(closeup.recipe) {
		await closeup.recipe(page);
		await page.wait(SETTLE_DELAY);
	}
	let clip = closeup.clip;
	if(closeup.selector) {
		const origin = await page.evaluate(`(() => {
			const r = document.querySelector(${JSON.stringify(closeup.selector)}).getBoundingClientRect();
			return {x: r.left, y: r.top};
		})()`);
		clip = Object.assign({},clip,{x: clip.x + origin.x, y: clip.y + origin.y});
	}
	return page.screenshot({clip, scale: 1, quality: CLOSEUP_QUALITY});
}

async function main() {
	const args = process.argv.slice(2),
		force = args.indexOf("--force") !== -1,
		only = args.filter(arg => arg !== "--force").map(arg => arg.replace(/^\/|\/$/g,"")),
		manifest = readManifest(),
		allTargets = findTargets();
	only.forEach(name => {
		if(!allTargets.find(target => target.path === name)) {
			throw new Error("Unknown target " + name + "; known targets are " + allTargets.map(target => target.path).join(", "));
		}
	});
	// Remove screenshots of targets that no longer exist
	if(!only.length) {
		Object.keys(manifest).forEach(name => {
			if(!allTargets.find(target => target.path === name)) {
				fs.rmSync(path.join(screenshotsDir,name + ".webp"),{force: true});
				fs.rmSync(path.join(closeupsDir,name + ".webp"),{force: true});
				delete manifest[name];
				console.log("build-screenshots: removed screenshot of " + name);
			}
		});
	}
	const stale = allTargets.filter(target => {
		if(only.length && only.indexOf(target.path) === -1) {
			return false;
		}
		if(!fs.existsSync(path.join(rootDir,target.dir,"index.html"))) {
			console.log("build-screenshots: skipping " + target.path + " as " + target.dir + "/index.html does not exist");
			return false;
		}
		target.hash = hashTarget(target);
		return force || manifest[target.path] !== target.hash || !fs.existsSync(target.outputFile) || (target.closeupFile && !fs.existsSync(target.closeupFile));
	});
	if(!stale.length) {
		writeManifest(manifest);
		console.log("build-screenshots: all screenshots are up to date");
		return;
	}
	const executable = findChrome();
	if(!executable) {
		console.log("build-screenshots: warning: Chrome not found (set CHROME_PATH), so not capturing " + stale.map(target => target.path).join(", "));
		writeManifest(manifest);
		return;
	}
	const server = await startServer(allTargets),
		baseUrl = "http://127.0.0.1:" + server.address().port + "/",
		browser = await launchChrome(executable);
	let failures = 0;
	try {
		for(const target of stale) {
			const page = await openPage(browser);
			try {
				await page.navigate(baseUrl + target.path + "/");
				if(recipes[target.path]) {
					await recipes[target.path](page);
					await page.wait(SETTLE_DELAY);
				}
				const image = await page.screenshot();
				fs.mkdirSync(path.dirname(target.outputFile),{recursive: true});
				fs.writeFileSync(target.outputFile,image);
				console.log("build-screenshots: captured " + target.path + " (" + Math.round(image.length / 1024) + "KB)");
				if(target.closeupFile) {
					const closeup = await captureCloseup(page,closeups[target.path]);
					fs.mkdirSync(path.dirname(target.closeupFile),{recursive: true});
					fs.writeFileSync(target.closeupFile,closeup);
					console.log("build-screenshots: captured close-up of " + target.path + " (" + Math.round(closeup.length / 1024) + "KB)");
				}
				manifest[target.path] = target.hash;
			} catch(e) {
				failures++;
				console.log("build-screenshots: warning: failed to capture " + target.path + ": " + e.message);
			} finally {
				await page.close();
			}
		}
	} finally {
		await browser.close();
		server.close();
		writeManifest(manifest);
	}
	if(failures) {
		process.exitCode = 1;
	}
}

// build-social.js renders its cards with the same Chrome
module.exports = {findChrome, launchChrome, openPage};

if(require.main === module) {
	main().catch(e => {
		console.error("build-screenshots: " + e.message);
		process.exit(1);
	});
}
