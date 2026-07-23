/*\
title: $:/plugins/tiddlywiki/static/components/table-of-contents/table-of-contents.js
type: application/javascript
tags: $:/tags/Static/JS
component: table-of-contents

An expandable table of contents

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

// Kick things off when we load
window.addEventListener("load",onLoad,false);

function onLoad() {
	// Trap clicks
	document.body.addEventListener("click",onClick,false);
}

function onClick(event) {
	var entry = findAncestorWithClass(event.target,"tc-toc-item");
	if(entry) {
		var trigger = findAncestorWithClass(event.target,"tc-toc-expand");
		if(trigger) {
			entry.classList.add("tc-toc-expanded");
			event.preventDefault();
			return false;
		}
		trigger = findAncestorWithClass(event.target,"tc-toc-contract");
		if(trigger) {
			entry.classList.remove("tc-toc-expanded");
			event.preventDefault();
			return false;
		}
	}
}

function findAncestorWithClass(node,className) {
	// Look for a dropdown trigger
	while(node && (!node.classList || !node.classList.contains(className))) {
		node = node.parentNode;
	}
	if(node && node.classList && node.classList.contains(className)) {
		return node;
	} else {
		return null;
	}
}

})();
