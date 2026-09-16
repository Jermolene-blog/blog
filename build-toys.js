/*
Generate the tiddlers that drive the /toys index page.

Each immediate subdirectory of `static-assets/toys` that contains an
`index.html` becomes a tiddler tagged `toy`, with its caption and description
read from the toy's own HTML `<title>` and `<meta>` tags. The caption comes from
`<meta name="toy-title">`, falling back to `og:title` and then `<title>`; the
description from `<meta name="toy-description">`, falling back to the standard
`description` and then `og:description`. The toy is therefore
the single source of truth for its own listing: adding, renaming or
re-describing a toy automatically updates the index at build time.

If `build-screenshots.js` has captured a screenshot of the toy, its URL is
recorded in the `screenshot` field.

Usage: node build-toys.js
*/

"use strict";

const fs = require("fs"),
	path = require("path");

const rootDir = __dirname,
	toysDir = path.join(rootDir,"static-assets","toys"),
	screenshotsDir = path.join(rootDir,"static-assets","screenshots","toys"),
	outputFile = path.join(rootDir,"main-wiki","tiddlers","generated","toys.json");

function decodeEntities(text) {
	return text
		.replace(/&lt;/g,"<")
		.replace(/&gt;/g,">")
		.replace(/&quot;/g,'"')
		.replace(/&#0?39;|&apos;/g,"'")
		.replace(/&nbsp;/g," ")
		.replace(/&amp;/g,"&");
}

function tidy(text) {
	return decodeEntities(text).replace(/\s+/g," ").trim();
}

// Collect the content of the `<meta>` tags of an HTML document, keyed by
// their `name` or `property` attribute
function parseMetaTags(html) {
	const metaTags = Object.create(null),
		metaRegExp = /<meta\b([^>]*)>/gi;
	let match;
	while((match = metaRegExp.exec(html))) {
		const attributes = Object.create(null),
			attributeRegExp = /([a-zA-Z][-a-zA-Z0-9:_.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
		let attributeMatch;
		while((attributeMatch = attributeRegExp.exec(match[1]))) {
			const value = attributeMatch[3] !== undefined ? attributeMatch[3] :
				attributeMatch[4] !== undefined ? attributeMatch[4] : attributeMatch[5];
			attributes[attributeMatch[1].toLowerCase()] = value;
		}
		const key = attributes.name || attributes.property;
		if(key && attributes.content !== undefined) {
			metaTags[key.toLowerCase()] = tidy(attributes.content);
		}
	}
	return metaTags;
}

function readToy(name) {
	const indexFile = path.join(toysDir,name,"index.html");
	if(!fs.existsSync(indexFile)) {
		console.log("build-toys: skipping toys/" + name + " as it has no index.html");
		return null;
	}
	const html = fs.readFileSync(indexFile,"utf8"),
		metaTags = parseMetaTags(html),
		titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html),
		caption = metaTags["toy-title"] || metaTags["og:title"] || (titleMatch ? tidy(titleMatch[1]) : name),
		description = metaTags["toy-description"] || metaTags.description || metaTags["og:description"] || "";
	if(!description) {
		console.log("build-toys: warning: toys/" + name + " has no description meta tag");
	}
	const toy = {
		title: "Toys/" + name,
		caption: caption,
		description: description,
		url: "/toys/" + name + "/",
		tags: "toy",
		text: ""
	};
	if(fs.existsSync(path.join(screenshotsDir,name + ".webp"))) {
		toy.screenshot = "/screenshots/toys/" + name + ".webp";
	} else {
		console.log("build-toys: warning: toys/" + name + " has no screenshot; run build-screenshots.js");
	}
	return toy;
}

const toys = fs.readdirSync(toysDir,{withFileTypes: true})
	.filter(entry => entry.isDirectory())
	.map(entry => readToy(entry.name))
	.filter(toy => !!toy)
	.sort((a,b) => a.caption.toLowerCase().localeCompare(b.caption.toLowerCase()));

fs.mkdirSync(path.dirname(outputFile),{recursive: true});
fs.writeFileSync(outputFile,JSON.stringify(toys,null,"\t") + "\n","utf8");

console.log("build-toys: wrote " + toys.length + " toys to " + path.relative(rootDir,outputFile));
