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

Screenshots are committed to the repository. `screenshots.json` records a hash
of each target's files and recipe, and a target is only recaptured when its
hash changes, so a normal build does not need Chrome at all. If Chrome cannot be
found, stale screenshots are left alone with a warning rather than failing the
build.

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
	manifestFile = path.join(rootDir,"screenshots.json");

// Bump to force every screenshot to be recaptured
const CAPTURE_VERSION = 1;

const VIEWPORT = {width: 1200, height: 800},
	WEBP_QUALITY = 80,
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
	"archive/cecily": async page => {
		// Let the zooming animations finish
		await page.wait(3000);
	},
	"talkytalky": async page => {
		await page.wait(2000);
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

function findTargets() {
	const toysDir = path.join(staticDir,"toys"),
		toys = fs.readdirSync(toysDir,{withFileTypes: true})
			.filter(entry => entry.isDirectory() && fs.existsSync(path.join(toysDir,entry.name,"index.html")))
			.map(entry => ({path: "toys/" + entry.name, dir: path.join("static-assets","toys",entry.name)}));
	return toys.concat(extraTargets).map(target => Object.assign({
		source: target.dir,
		outputFile: path.join(screenshotsDir,target.path + ".webp")
	},target));
}

// Hash the relative paths and contents of the files in a target's source
// folder, along with the recipe and capture settings. Files ignored by git
// are left out so that a fresh checkout computes the same hash
function hashTarget(target) {
	const hash = crypto.createHash("sha256"),
		sourceDir = path.join(rootDir,target.source),
		listing = childProcess.execFileSync("git",["ls-files","-z","--cached","--others","--exclude-standard","--","."],{cwd: sourceDir, encoding: "utf8"}),
		files = Array.from(new Set(listing.split("\0").filter(Boolean))).sort();
	hash.update(JSON.stringify({CAPTURE_VERSION, VIEWPORT, WEBP_QUALITY, recipe: String(recipes[target.path] || "")}));
	files.forEach(file => {
		const fullPath = path.join(sourceDir,file);
		// Deleted but not yet staged files are still listed
		if(fs.existsSync(fullPath)) {
			hash.update(file + "\0");
			hash.update(fs.readFileSync(fullPath));
			hash.update("\0");
		}
	});
	return hash.digest("hex");
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

// Serve each target's folder at its published path
function startServer(targets) {
	const server = http.createServer((request,response) => {
		const urlPath = decodeURIComponent(new URL(request.url,"http://localhost").pathname),
			target = targets.find(target => urlPath === "/" + target.path || urlPath.startsWith("/" + target.path + "/"));
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
async function openPage(browser) {
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
	await send("Emulation.setDeviceMetricsOverride",{width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false});
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
		async screenshot() {
			const {data} = await send("Page.captureScreenshot",{format: "webp", quality: WEBP_QUALITY});
			return Buffer.from(data,"base64");
		},
		close() {
			return browser.send("Target.closeTarget",{targetId});
		}
	};
	return page;
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
		return force || manifest[target.path] !== target.hash || !fs.existsSync(target.outputFile);
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
				manifest[target.path] = target.hash;
				console.log("build-screenshots: captured " + target.path + " (" + Math.round(image.length / 1024) + "KB)");
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

main().catch(e => {
	console.error("build-screenshots: " + e.message);
	process.exit(1);
});
