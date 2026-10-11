/*\
title: $:/_Toys/PWA.js
type: application/javascript
tags: $:/tags/Static/JS

On the Toys page, which $:/_Toys/PWA marks with its web app manifest, load the
script shared with the toys that registers the service worker. A <script> tag
cannot be written in the wikified head, so it is loaded from here instead

\*/
(function(){

"use strict";

if(document.querySelector('link[rel="manifest"][href="/toys/manifest.webmanifest"]')) {
	var script = document.createElement("script");
	script.src = "/toys/pwa.js";
	document.head.appendChild(script);
}

})();
