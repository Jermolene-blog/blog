/*\
title: $:/plugins/tiddlywiki/static/components/stacked-view/stacked-view.js
type: application/javascript
tags: $:/tags/Static/JS
component: stacked-view

A scrolling animation that thumbnails the page content when scrolled to the top

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var EASING = "cubic-bezier(0.645, 0.045, 0.355, 1)", // From http://easings.net/#easeInOutCubic
	FAN_HEIGHT = "50vh",
	ANIM_DURATION = 300; // milliseconds

var lastScrollPosition = 0,
	isWaitingForAnimationFrame,
	isAutoScrolling = false,
  	tiddlers = [], // Array of {domNode:, title:, top:, left:, width:}], zeroth element is on top of stack
	maxHeight,
	domStoryRiver = document.querySelector(".tc-story-river"),
	domPageFooter = document.querySelector(".tc-page-footer");

// Kick things off when we load
domStoryRiver.style.visibility = "hidden";
document.addEventListener("DOMContentLoaded",onReady);

function onReady() {
	// Read our tiddlers from the DOM
	var n = domStoryRiver.firstElementChild;
	while(n) {
		var computedStyle = window.getComputedStyle(n);
		tiddlers.push({
			domNode: n,
			title: n.getAttribute("data-tiddler-title"),
			top: n.offsetTop,
			left: n.offsetLeft,
			width: n.offsetWidth,
			height: n.offsetHeight,
			borderLeftWidth: parseInt(computedStyle.borderLeftWidth,10),
			borderRightWidth: parseInt(computedStyle.borderRightWidth,10),
			paddingLeft: parseInt(computedStyle.paddingLeft,10),
			paddingRight: parseInt(computedStyle.paddingRight,10)
		});
		n = n.nextElementSibling;
	}
	// Layout the tiddlers on the screen
	lastScrollPosition = window.scrollY;
	placeTiddlers();
	// Set tiddler styles
	for(var index = 0; index < tiddlers.length; index++) {
		var tiddler = tiddlers[index];
		tiddler.domNode.style.position = "absolute";
		tiddler.domNode.style.transformOrigin = "50% 0";
		tiddler.domNode.style.width = (tiddler.width - tiddler.paddingLeft - tiddler.paddingRight - tiddler.borderLeftWidth - tiddler.borderRightWidth) + "px";
		// tiddler.domNode.style.transition = "transform " + ANIM_DURATION + "ms " + EASING;
	}
	// Add the fan height to the top of the story river as padding, and then cancel it out with a margin
	domStoryRiver.style.paddingTop = FAN_HEIGHT;
	// Add the screen height to the bottom of the story river, to ensure that we can scroll to the top of the story river
	domStoryRiver.style.paddingBottom = "100vh";
	// Set the perspective depth
	domStoryRiver.style.perspective = "200px";
	domStoryRiver.style.perspectiveOrigin = "50% 0%";
	domStoryRiver.style.transformStyle = "preserve-3d";
	// domStoryRiver.style.background = "rgba(0,0,0,0.2)";
	// Trap clicks
	document.body.addEventListener("click",onClick,false);
	// Trap scrolling
	window.addEventListener("scroll",onScroll,false);
	// Scroll to the top of the story river
	window.scrollTo(0,getFanHeight());
	// scrollTo(getFanHeight(),{duration: 0});
	updateScrollAnimation(window.scrollY);
	// Restore the visibility of the story river
	domStoryRiver.style.visibility = "visible";
	// Set tiddler styles
	for(index = 0; index < tiddlers.length; index++) {
		tiddler = tiddlers[index];
		tiddler.domNode.style.transition = "transform " + ANIM_DURATION + "ms " + EASING;
	}
}

function getFanHeight() {
	return parseInt(window.getComputedStyle(domStoryRiver).paddingTop,10);
}

function onClick(event) {
	// Look for a tiddler frame, and move it to the top if we find one
	var n = event.target;
	while(n && (!n.classList || !n.classList.contains("tc-tiddler-frame"))) {
		n = n.parentNode;
	}
	if(n && n.classList && n.classList.contains("tc-tiddler-frame")) {
		// Get the target title and find it in the tiddlers array
		var title = n.getAttribute("data-tiddler-title"),
			index = tiddlers.findIndex(function(tiddler) {
				return tiddler.title === title;
			});
		if(index === -1) {
			console.log("Unknown tiddler: " + title);
		} else if(index !== 0) {
			// Move the target tiddler to the top of the stack
			var tiddler = tiddlers[index];
			tiddlers.splice(index,1);
			tiddlers.unshift(tiddler);
			placeTiddlers();
			scrollTo(getFanHeight(),{delay: ANIM_DURATION});
		}
	}
	// Look for a link
	var n = event.target;
	while(n && (!n.classList || !n.classList.contains("tc-tiddlylink"))) {
		n = n.parentNode;
	}
	if(n && n.classList && n.classList.contains("tc-tiddlylink")) {
		console.log("Navigating to",n.getAttribute("href"));
		event.preventDefault();
		return false;
	}
}

function onScroll(event) {
	lastScrollPosition = window.scrollY;
	if(!isWaitingForAnimationFrame) {
		window.requestAnimationFrame(function() {
				updateScrollAnimation(lastScrollPosition);
			isWaitingForAnimationFrame = false;
		});
	}
	isWaitingForAnimationFrame = true;
}

function updateScrollAnimation(scrollPos) {
	var fanHeight = getFanHeight();
	if(scrollPos < fanHeight) {
		domStoryRiver.style.perspectiveOrigin = "50% " + (110 * scrollPos / fanHeight) + "%";
	} else {
		domStoryRiver.style.perspectiveOrigin = "50% 110%";
	}
}

function placeTiddlers() {
	// Place the tiddlers
	for(var index = 0; index < tiddlers.length; index++) {
		var tiddler = tiddlers[index],
			maxTranslateZ = 1000,
			translateZ = - index * 100;
		tiddler.domNode.style.transform = "translate3d(0,0," + translateZ + "px)";
	}
}

function scrollTo(targetPos,options) {
console.log("scrollTo",targetPos,options)
	options = options || {};
	var delay = options.delay || 0,
		duration = options.duration === undefined ? ANIM_DURATION : options.duration,
		startPos = window.scrollY,
		timeStart,
		timeElapsed;
	isAutoScrolling = true;
	window.requestAnimationFrame(function(time) {
		timeStart = time;
		scrollStep(time);
	});
	function scrollStep(time) {
		timeElapsed = time - timeStart;
		if(timeElapsed < delay) {
			// Wait for the delay
			window.requestAnimationFrame(scrollStep)
		} else if(timeElapsed < (delay + duration)) {
			var scrollPos = startPos + (targetPos - startPos) * easeInOutQuad((timeElapsed - delay) / duration);
			window.scrollTo(0, scrollPos);
			window.requestAnimationFrame(scrollStep)
		} else {
			window.scrollTo(0, targetPos);
			isAutoScrolling = false;
		}
	}
}

// Thanks to https://github.com/gre/bezier-easing
function easeInOutQuad(t) {
	return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

})();
