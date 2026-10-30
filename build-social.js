/*
Make the pictures shown when a page of the site is shared on social media: a
1200x630 card for each toy, post and page, with a close-up of its most
interesting part beside its title and a line or two about it.

The cards are:

* One for each toy, from the toys listed in `main-wiki/tiddlers/generated/toys.json`
  by build-toys.js: its close-up captured by build-screenshots.js, its caption,
  its `<meta name="toy-tagline">` and its theme colour
* One for each post and page in the main wiki, as listed by `$:/_Social/Cards`:
  its caption or title and its `description` field, beside the close-ups named
  in its `social-closeup` field, or else the image tiddler named in its
  `social-image` field, or else the site banner

The card for the page at `/<path>` is saved as `static-assets/social/<path>.jpg`,
and so is published at `/social/<path>.jpg` (the home page's card is
`index.jpg`). The `og:image` tags pointing at them are written into the wiki's
pages by `$:/_Social/Meta`, and into the toys by `node build-social.js --tags`,
which bld.sh runs after assembling the site.

Cards are drawn as HTML in headless Chrome, using build-screenshots.js to drive
it, and committed to the repository. `social.json` records a hash of each card's
text, pictures and template, and a card is only redrawn when its hash changes,
so a normal build doesn't need Chrome. If Chrome cannot be found, stale cards
are left alone with a warning.

Usage: node build-social.js [--force] [<path>...]
       node build-social.js --tags

  --force   redraw even if the hash is unchanged
  <path>    only consider the given cards, eg `toys/knottery` or `post/mimic`
  --tags    add the social media tags to the toys in the assembled site/ folder

Set CHROME_PATH to use a particular Chrome or Chromium executable.
*/

"use strict";

const fs = require("fs"),
	os = require("os"),
	path = require("path"),
	crypto = require("crypto"),
	childProcess = require("child_process"),
	{findChrome, launchChrome, openPage} = require("./build-screenshots.js");

const rootDir = __dirname,
	closeupsDir = path.join(rootDir,"social","closeups"),
	cardsDir = path.join(rootDir,"static-assets","social"),
	toysFile = path.join(rootDir,"main-wiki","tiddlers","generated","toys.json"),
	siteDir = path.join(rootDir,"site"),
	manifestFile = path.join(rootDir,"social.json");

// Bump to force every card to be redrawn
const CARD_VERSION = 1;

const CARD = {width: 1200, height: 630},
	JPEG_QUALITY = 88,
	// The height of the picture across the top of a wide card
	WIDE_BAND = 370,
	BASE_URL = "https://jermolene.com",
	SITE_NAME = "Jermolene",
	// jermolene-primary in $:/_CustomPalette
	DEFAULT_ACCENT = "#5c59a7";

const toyKinds = {games: "Game", trifles: "Trifle", tools: "Tool"};

// The card is laid out by the page below, which is given the card as JSON. A
// square picture sits to the right of the text, and a wide one across the top
const template = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Open+Sans:wght@400;600;700&display=block" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:${CARD.width}px;height:${CARD.height}px;overflow:hidden}
body{display:grid;background:var(--accent);color:var(--ink);font-family:"Open Sans",sans-serif;-webkit-font-smoothing:antialiased}
body.square{grid-template-columns:1fr ${CARD.height}px}
body.wide{grid-template-rows:var(--band) 1fr}
.pictures{position:relative;display:grid;overflow:hidden;background:#000}
body.square .pictures{grid-column:2;grid-row:1}
.pictures.grid{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;background:var(--accent)}
.pictures img{width:100%;height:100%;object-fit:cover;display:block;min-width:0;min-height:0}
.text{display:flex;flex-direction:column;padding:52px 56px 44px;min-width:0;min-height:0}
body.square .text{grid-column:1;grid-row:1}
body.wide .text{padding:30px 56px 34px}
.kicker{font:700 19px/1 "Open Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase;opacity:.75}
h1{font:900 60px/1.12 Merriweather,serif;margin-top:22px;letter-spacing:-.01em}
body.wide h1{margin-top:14px}
p{font:400 29px/1.4 "Open Sans",sans-serif;margin-top:22px;opacity:.92;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
body.wide p{margin-top:10px}
.url{margin-top:auto;padding-top:20px;font:600 22px/1.2 "Open Sans",sans-serif;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
body.wide .text{display:grid;grid-template-columns:1fr auto;align-content:center;column-gap:40px}
body.wide .kicker,body.wide h1,body.wide p{grid-column:1}
body.wide .url{grid-column:2;grid-row:1;margin:0;padding:0;align-self:start}
</style></head>
<body><div class="pictures"></div><div class="text"><div class="kicker"></div><h1></h1><p></p><div class="url"></div></div>
<script>
const card = __CARD__;
document.documentElement.style.setProperty("--accent",card.accent);
document.documentElement.style.setProperty("--ink",card.ink);
const pictures = document.querySelector(".pictures");
pictures.classList.toggle("grid",card.pictures.length > 1);
document.body.className = card.layout;
document.documentElement.style.setProperty("--band",card.band + "px");
const loading = card.pictures.map(picture => {
	const img = document.createElement("img");
	img.src = picture.src;
	if(picture.clip) {
		img.style.objectViewBox = "xywh(" + picture.clip.map(n => n + "px").join(" ") + ")";
	}
	pictures.appendChild(img);
	return img.decode();
});
document.querySelector(".kicker").textContent = card.kicker;
document.querySelector(".url").textContent = card.url;
const h1 = document.querySelector("h1"),
	p = document.querySelector("p");
h1.textContent = card.title;
p.textContent = card.line;
window.ready = Promise.all(loading.concat([document.fonts.ready])).then(() => {
	// Shrink the title until it fits in its lines, then give the description
	// the lines that are left
	const maxTitleLines = card.layout === "wide" ? 1 : 3;
	let size = 60;
	const lines = () => Math.round(h1.getBoundingClientRect().height / (size * 1.12));
	while(size > 34 && (lines() > maxTitleLines || h1.scrollWidth > h1.clientWidth)) {
		size -= 2;
		h1.style.fontSize = size + "px";
	}
	const url = document.querySelector(".url"),
		lineHeight = 29 * 1.4;
	p.style.webkitLineClamp = card.layout === "wide" ? 2 : Math.max(1,Math.min(5,Math.floor((url.offsetTop - p.offsetTop - 20) / lineHeight)));
	// Shrink a long address to fit on one line
	let urlSize = 22;
	while(urlSize > 15 && url.scrollWidth > url.clientWidth) {
		urlSize -= 1;
		url.style.fontSize = urlSize + "px";
	}
	return true;
});
</script>
</body></html>`;

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

// Dark text on light colours and light text on dark ones
function inkFor(colour) {
	const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour.length === 4 ? colour.replace(/([0-9a-f])/gi,"$1$1") : colour);
	if(!match) {
		return "#ffffff";
	}
	const [r,g,b] = match.slice(1).map(hex => {
		const c = parseInt(hex,16) / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055,2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#1c1a17" : "#ffffff";
}

function closeupFile(target) {
	return path.join(closeupsDir,target + ".webp");
}

function toyCards() {
	return JSON.parse(fs.readFileSync(toysFile,"utf8")).map(toy => {
		const name = toy.title.replace(/^Toys\//,""),
			accent = toy["theme-color"] || DEFAULT_ACCENT;
		return {
			route: "toys/" + name,
			title: toy.caption,
			line: toy.tagline || toy.description,
			description: toy.description,
			kicker: SITE_NAME + " · " + (toyKinds[toy.category] || "Toy"),
			accent: accent,
			pictures: [{file: closeupFile("toys/" + name)}]
		};
	});
}

// The posts and pages are listed by rendering $:/_Social/Cards from the wiki
function wikiCards(workDir) {
	childProcess.execFileSync("tiddlywiki",["main-wiki","--output",workDir,"--render","[[$:/_Social/Cards]]","[[cards.json]]","text/plain"],{
		cwd: rootDir,
		env: Object.assign({},process.env,{TIDDLYWIKI_PLUGIN_PATH: path.join(rootDir,"plugins")}),
		stdio: ["ignore","ignore","inherit"]
	});
	const entries = JSON.parse(fs.readFileSync(path.join(workDir,"cards.json"),"utf8")),
		home = entries.find(entry => entry.route === "index");
	return entries.map(entry => {
		let pictures;
		if(entry.closeups) {
			pictures = entry.closeups.split(/\s+/).map(target => ({file: closeupFile(target)}));
		} else {
			const extension = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}[entry.imageType] || "",
				file = path.join(workDir,crypto.createHash("sha256").update(entry.imageData).digest("hex") + extension);
			fs.writeFileSync(file,Buffer.from(entry.imageData,"base64"));
			pictures = [{file, clip: entry.imageClip ? entry.imageClip.split(/\s+/).map(Number) : null}];
		}
		return {
			route: entry.route,
			title: entry.title,
			line: entry.description || home.description,
			description: entry.description || home.description,
			kicker: SITE_NAME + (entry.date ? " · " + entry.date : ""),
			accent: DEFAULT_ACCENT,
			pictures
		};
	});
}

function imageSize(file) {
	const data = fs.readFileSync(file);
	if(data.toString("ascii",0,4) === "RIFF") {
		const chunk = data.toString("ascii",12,16);
		if(chunk === "VP8 ") {
			return {width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff};
		} else if(chunk === "VP8L") {
			const bits = data.readUInt32LE(21);
			return {width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1};
		} else if(chunk === "VP8X") {
			return {width: data.readUIntLE(24,3) + 1, height: data.readUIntLE(27,3) + 1};
		}
	} else if(data.readUInt32BE(0) === 0x89504e47) {
		return {width: data.readUInt32BE(16), height: data.readUInt32BE(20)};
	} else if(data.readUInt16BE(0) === 0xffd8) {
		let offset = 2;
		while(offset < data.length) {
			const marker = data.readUInt16BE(offset);
			if(marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4 && marker !== 0xffc8 && marker !== 0xffcc) {
				return {width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5)};
			}
			offset += 2 + data.readUInt16BE(offset + 2);
		}
	}
	throw new Error("Cannot read the size of " + file);
}

// Settle the layout and everything else the page needs, and the card's hash
function prepareCard(card) {
	const missing = card.pictures.filter(picture => !fs.existsSync(picture.file));
	if(missing.length) {
		card.missing = missing.map(picture => path.relative(rootDir,picture.file));
		return card;
	}
	const first = card.pictures[0],
		size = first.clip ? {width: first.clip[2], height: first.clip[3]} : imageSize(first.file),
		aspect = size.width / size.height;
	card.layout = card.pictures.length === 1 && aspect > 1.4 ? "wide" : "square";
	card.band = WIDE_BAND;
	card.ink = inkFor(card.accent);
	card.url = BASE_URL.replace(/^https?:\/\//,"") + (card.route === "index" ? "" : "/" + card.route);
	const hash = crypto.createHash("sha256");
	hash.update(JSON.stringify({CARD_VERSION, CARD, JPEG_QUALITY, WIDE_BAND, template,
		card: {title: card.title, line: card.line, kicker: card.kicker, accent: card.accent, layout: card.layout, band: card.band, url: card.url,
			clips: card.pictures.map(picture => picture.clip || null)}}));
	card.pictures.forEach(picture => hash.update(fs.readFileSync(picture.file)));
	card.hash = hash.digest("hex");
	card.outputFile = path.join(cardsDir,card.route + ".jpg");
	return card;
}

async function drawCard(browser,card,workDir) {
	const page = await openPage(browser,CARD);
	try {
		const data = {
				title: card.title, line: card.line, kicker: card.kicker, url: card.url, accent: card.accent, ink: card.ink,
				layout: card.layout, band: card.band,
				pictures: card.pictures.map(picture => ({src: "file://" + picture.file, clip: picture.clip}))
			},
			htmlFile = path.join(workDir,"card.html");
		fs.writeFileSync(htmlFile,template.replace("__CARD__",JSON.stringify(data).replace(/</g,"\\u003c")));
		await page.navigate("file://" + htmlFile);
		await page.evaluate("window.ready");
		return await page.screenshot({format: "jpeg", quality: JPEG_QUALITY, clip: {x: 0, y: 0, width: CARD.width, height: CARD.height}});
	} finally {
		await page.close();
	}
}

async function drawCards(args) {
	const force = args.indexOf("--force") !== -1,
		only = args.filter(arg => arg !== "--force").map(arg => arg.replace(/^\/|\/$/g,"")),
		manifest = readManifest(),
		workDir = fs.mkdtempSync(path.join(os.tmpdir(),"build-social-"));
	try {
		const cards = toyCards().concat(wikiCards(workDir)).map(prepareCard);
		only.forEach(route => {
			if(!cards.find(card => card.route === route)) {
				throw new Error("Unknown card " + route + "; known cards are " + cards.map(card => card.route).join(", "));
			}
		});
		// Remove cards for pages that no longer exist
		if(!only.length) {
			Object.keys(manifest).forEach(route => {
				if(!cards.find(card => card.route === route)) {
					fs.rmSync(path.join(cardsDir,route + ".jpg"),{force: true});
					delete manifest[route];
					console.log("build-social: removed card for " + route);
				}
			});
		}
		const stale = cards.filter(card => {
			if(only.length && only.indexOf(card.route) === -1) {
				return false;
			}
			if(card.missing) {
				console.log("build-social: warning: not drawing the card for " + card.route + " as " + card.missing.join(", ") + " does not exist; run build-screenshots.js");
				return false;
			}
			return force || manifest[card.route] !== card.hash || !fs.existsSync(card.outputFile);
		});
		if(!stale.length) {
			writeManifest(manifest);
			console.log("build-social: all cards are up to date");
			return;
		}
		const executable = findChrome();
		if(!executable) {
			console.log("build-social: warning: Chrome not found (set CHROME_PATH), so not drawing " + stale.map(card => card.route).join(", "));
			writeManifest(manifest);
			return;
		}
		const browser = await launchChrome(executable);
		let failures = 0;
		try {
			for(const card of stale) {
				try {
					const image = await drawCard(browser,card,workDir);
					fs.mkdirSync(path.dirname(card.outputFile),{recursive: true});
					fs.writeFileSync(card.outputFile,image);
					manifest[card.route] = card.hash;
					console.log("build-social: drew " + card.route + " (" + Math.round(image.length / 1024) + "KB)");
				} catch(e) {
					failures++;
					console.log("build-social: warning: failed to draw " + card.route + ": " + e.message);
				}
			}
		} finally {
			await browser.close();
			writeManifest(manifest);
		}
		if(failures) {
			process.exitCode = 1;
		}
	} finally {
		fs.rmSync(workDir,{recursive: true, force: true});
	}
}

function escapeAttribute(text) {
	return String(text).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// The toys are published verbatim, so their tags are added to the copies in
// the assembled site rather than to their sources
function addToyTags() {
	toyCards().forEach(card => {
		const file = path.join(siteDir,card.route,"index.html");
		if(!fs.existsSync(file)) {
			return;
		}
		const html = fs.readFileSync(file,"utf8"),
			url = BASE_URL + "/" + card.route + "/",
			tags = [
				["property","og:type","website"],
				["property","og:site_name",SITE_NAME],
				["property","og:title",card.title],
				["property","og:description",card.description],
				["property","og:url",url],
				["name","twitter:card","summary_large_image"]
			];
		if(fs.existsSync(path.join(cardsDir,card.route + ".jpg"))) {
			tags.push(["property","og:image",BASE_URL + "/social/" + card.route + ".jpg"],
				["property","og:image:width",String(CARD.width)],
				["property","og:image:height",String(CARD.height)],
				["property","og:image:alt",card.title + ": " + card.line]);
		}
		// Not every toy closes its <head>, but they all start by declaring a charset
		const markup = "\n" + tags.map(([attribute,name,content]) => `<meta ${attribute}="${name}" content="${escapeAttribute(content)}">`).join("\n"),
			charset = /<meta (charset|http-equiv="content-type")[^>]*>/i.exec(html);
		if(!charset || /<meta property="og:/.test(html)) {
			console.log("build-social: warning: not adding tags to " + card.route + " as it " + (charset ? "already has og: tags" : "has no charset meta tag"));
			return;
		}
		const insertAt = charset.index + charset[0].length;
		fs.writeFileSync(file,html.slice(0,insertAt) + markup + html.slice(insertAt));
	});
	console.log("build-social: added social media tags to the toys");
}

const args = process.argv.slice(2);
if(args.indexOf("--tags") !== -1) {
	addToyTags();
} else {
	drawCards(args).catch(e => {
		console.error("build-social: " + e.message);
		process.exit(1);
	});
}
