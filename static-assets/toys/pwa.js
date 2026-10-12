/*
Shared by the toys index at /toys/ and by every toy beneath it, which include
it with `<script src="../pwa.js" defer></script>`.

It registers the service worker `sw.js` next to this script, whose scope
covers the index and all of the toys, so that whichever page is visited first
makes the whole collection available offline and installable.

When the index has been installed as an app, each toy opened from it shows a
small button in the bottom-left corner that returns to the index. The button
only appears inside the installed index app: a toy installed as an app in its
own right, or viewed in an ordinary browser tab, is left alone. The index app
marks its window in sessionStorage when it runs in standalone mode, and that
mark is still present when the user navigates on to a toy within the same
window.

The site's menu links to the index as /toys without a trailing slash, which
lies outside the worker's scope and so cannot be served offline, so such links
are given their trailing slash on the pages this script runs on.

When a toy is opened from disk there is nothing to do.
*/

(function() {

"use strict";

var script = document.currentScript;
if(!script || !/^https?:$/.test(location.protocol)) {
	return;
}

var toysUrl = new URL("./",script.src),
	hubPath = toysUrl.pathname,
	isHub = location.pathname === hubPath || location.pathname === hubPath.replace(/\/$/,""),
	standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true,
	HUB_WINDOW_KEY = "jermolene-toys-hub-window";

if("serviceWorker" in navigator) {
	// The worker is always fetched from the network when checking for updates.
	// An app on an iPad home screen is resumed rather than reloaded, so it also
	// checks whenever it comes back into view
	navigator.serviceWorker.register(new URL("sw.js",script.src).href,{updateViaCache: "none"}).then(function(registration) {
		document.addEventListener("visibilitychange",function() {
			if(document.visibilityState === "visible") {
				registration.update().catch(function() {});
			}
		});
	}).catch(function() {});
}

var fromHub = false;
try {
	if(isHub && standalone) {
		sessionStorage.setItem(HUB_WINDOW_KEY,"1");
	}
	fromHub = !isHub && standalone && sessionStorage.getItem(HUB_WINDOW_KEY) === "1";
} catch(e) {
	// sessionStorage can be unavailable; there is then no way home but the platform's own back gesture
}

if(document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded",onReady);
} else {
	onReady();
}

function onReady() {
	normaliseHubLinks();
	if(fromHub) {
		addHomeButton();
	}
}

function normaliseHubLinks() {
	var links = document.querySelectorAll("a[href]");
	for(var i = 0; i < links.length; i++) {
		var link = links[i];
		if(link.origin === location.origin && link.pathname === hubPath.replace(/\/$/,"")) {
			link.pathname = hubPath;
		}
	}
}

function addHomeButton() {
	var link = document.createElement("a"),
		style = document.createElement("style");
	style.textContent = [
		".jermolene-toys-home{position:fixed;z-index:2147483647;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(10px + env(safe-area-inset-bottom,0px));",
		"box-sizing:border-box;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;",
		"background:rgba(20,20,20,.55);color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);",
		"opacity:1;transition:opacity .4s;-webkit-tap-highlight-color:transparent;text-decoration:none;font:0/0 sans-serif}",
		".jermolene-toys-home.jermolene-toys-home-faded{opacity:.4}",
		".jermolene-toys-home:hover,.jermolene-toys-home:focus-visible{opacity:1}",
		".jermolene-toys-home svg{width:20px;height:20px;display:block}"
	].join("");
	link.className = "jermolene-toys-home";
	link.href = toysUrl.href;
	link.title = "Back to the toys";
	link.setAttribute("aria-label","Back to the toys");
	link.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
		'<rect x="2.5" y="2.5" width="6" height="6" rx="1.2"/><rect x="11.5" y="2.5" width="6" height="6" rx="1.2"/>' +
		'<rect x="2.5" y="11.5" width="6" height="6" rx="1.2"/><rect x="11.5" y="11.5" width="6" height="6" rx="1.2"/></svg>';
	document.head.appendChild(style);
	document.body.appendChild(link);
	setTimeout(function() {
		link.classList.add("jermolene-toys-home-faded");
	},4000);
}

})();
