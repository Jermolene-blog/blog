/*\
title: $:/plugins/tiddlywiki/static/components/scroll-flyer/scroll-flyer.js
type: application/javascript
tags: $:/tags/Static/JS
component: scroll-flyer

A scrolling animation that thumbnails the page content when scrolled to the top

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var duration = 1100,
  	lastScrollPosition = 0,
  	lastTiltPosition = 0,
  	tiddlerScrollOffset = 0,
	isWaitingForAnimationFrame = false,
	isAutoScrolling = false,
	tiddlerShuffledPositions = [],
	tiddlerNormalPositions = [],
	tiddlerByTitle = {},
	domMenuBar = document.querySelector(".tc-hamburger-menu"),
	domPageHeader = document.querySelector(".tc-page-heading"),
	domTiddlers = document.querySelectorAll(".tc-story-river .tc-tiddler-frame");

// Set the opacity of the menu bar and each tiddler to hide them
domMenuBar.style.visibility = "hidden";
eachDomTiddler(function(domTiddler,index) {
	domTiddler.style.visibility = "hidden";
});
// Remove id's from tiddlers (to prevent scrolling when the hash changes)
var anchors = document.querySelectorAll("a[id]");
for(var index = 0; index < anchors.length; index++) {
	anchors[index].removeAttribute("id");
}
// Attach our event listeners
window.addEventListener("load",onLoad,false);
window.addEventListener("scroll",onScroll,false);
// window.addEventListener("deviceorientation",onDeviceOrientationEvent,false);
window.addEventListener("resize",onResize,false);
document.body.addEventListener("click",onClick,false);
window.addEventListener("hashchange",onHashChange,false);
measureTiddlers();

function onLoad() {
	// Measure the starting position of tiddlers
	measureTiddlers();
	// Force the scroll animation
	if(window.scrollY === 0) {
		lastScrollPosition = window.scrollY;
		updateScrollAnimation(lastScrollPosition);
	}
	// Process any hash portion of the URL
	onHashChange();
	// Reset the opacity of the menu bar and each tiddler to display them again
	domMenuBar.style.visibility = "visible";
	eachDomTiddler(function(domTiddler,index) {
		domTiddler.style.visibility = "visible";
	});
}

function onScroll(e) {
	if(!isAutoScrolling) {
		lastScrollPosition = window.scrollY;
		triggerAnimationFrame();
	}
}

function triggerAnimationFrame() {
	if(!isWaitingForAnimationFrame) {
		window.requestAnimationFrame(function() {
				updateScrollAnimation(lastScrollPosition);
			isWaitingForAnimationFrame = false;
		});
	}
	isWaitingForAnimationFrame = true;
}

function onDeviceOrientationEvent(eventData) {
	lastTiltPosition = eventData.beta;
	triggerAnimationFrame();
}

function onResize() {
	measureTiddlers();
	lastScrollPosition = window.scrollY;
	updateScrollAnimation(lastScrollPosition);
}

function measureTiddlers() {
	// Measure the base position for the shuffled tiddlers
	var shuffleTop = domPageHeader.offsetTop + domPageHeader.offsetHeight + parseInt(window.getComputedStyle(domPageHeader).marginBottom,10) / 2;
	// Measure the offset for scrolling to a tiddler
	tiddlerScrollOffset = document.querySelector(".tc-tiddler-frame .tc-tiddler-anchor").offsetTop;
	// Save the current tiddler positions as the end positions
	eachDomTiddler(function(domTiddler,index) {
		tiddlerNormalPositions[index] = {
			l: domTiddler.offsetLeft,
			x: domTiddler.offsetLeft + domTiddler.offsetWidth/2,
			y: domTiddler.offsetTop,
			w: domTiddler.offsetWidth,
			h: domTiddler.offsetHeight
		};
		tiddlerByTitle[domTiddler.getAttribute("data-tiddler-title")] = index;
	});
	// Generate the starting positions
	var scale = 0.27,
		halfTiddlerWidth = tiddlerNormalPositions[0].w * scale / 2,
		minX = domPageHeader.offsetLeft + halfTiddlerWidth,
		maxX = domPageHeader.offsetLeft + domPageHeader.offsetWidth - halfTiddlerWidth;
	for(var t=0; t<tiddlerNormalPositions.length; t++) {
		var pos = t/(tiddlerNormalPositions.length - 1);
		tiddlerShuffledPositions[t] = {
			x: minX + (maxX - minX) * pos,
			y: shuffleTop,
			rotate: 0.2 - pos * 0.4,
			scale: scale
		}
	}
}

function eachDomTiddler(callback) {
	for(var index = 0; index < domTiddlers.length; index++) {
		callback(domTiddlers[index],index);
	}
}

function updateScrollAnimation(scrollPos) {
	// Initialise
	var animTop = tiddlerNormalPositions[0].y * 0.8, // Lowest scroll position for the animation
		pos = Math.min(1,scrollPos/animTop), // Scroll position 0..1
		easedPos = easeInOutQuad(pos,0,1,1), // Eased scroll position 0..1
		overEasedPos = easeInOutQuad(-scrollPos/animTop,0,1,1); // Easing used for negative scroll positions
	// Determine where we are in the animation
	if(scrollPos <= 0 || pos === 0) {
		// At or above the top of the page, hide the menubar and set classes
		domMenuBar.style.transform = "translateZ(0) translateY(-100%)";
		document.body.classList.add("scrolled-top");
		document.body.classList.remove("scrolled-mid");
		document.body.classList.remove("scrolled-bottom");
	} else if(pos === 1) {
		// Show the menu bar at the bottom of the page
		domMenuBar.style.transform = "none";
		document.body.classList.remove("scrolled-top");
		document.body.classList.remove("scrolled-mid");
		document.body.classList.add("scrolled-bottom");
	} else {
		// Animate in between
		domMenuBar.style.transform = "translateZ(0) translateY(-" + Math.min((1 - pos) * 100,100) + "%)";
		document.body.classList.remove("scrolled-top");
		document.body.classList.add("scrolled-mid");
		document.body.classList.remove("scrolled-bottom");
	}
	// Move each tiddler to the right position
	eachDomTiddler(function(domTiddler,index) {
		var shuffled = tiddlerShuffledPositions[index],
			normal = tiddlerNormalPositions[index],
			x, y, z = "", s, r, transform;
		if(scrollPos >= 0) {
			// Scroll
			x = (shuffled.x - normal.x) * (1 - easedPos);
			y = (shuffled.y - normal.y) * (1 - easedPos);
			if(scrollPos > 0) {
				z = "translateZ(0px)";
			}
			s = 1 + (shuffled.scale - 1) * (1 - easedPos);
			r = (shuffled.rotate  - lastTiltPosition * (6.28 / 360)) * (1 - easedPos);
		} else {
			// Overscroll
			x = shuffled.x - normal.x;
			y = shuffled.y - normal.y;
			z = "translateZ(0px)";
			s = shuffled.scale;
			r = shuffled.rotate + ((10 + index * 3) * overEasedPos);
		}
		transform = z + " translateX(" + x + "px) translateY(" + y + "px) scale(" + s + ") rotate(" + r + "rad)";
		domTiddler.style.transform = transform;
	});
}

function onClick(e) {
	var domTiddler;
	// Check for clicking on a local link with the same location hash
	domTiddler = e.target;
	while(domTiddler && ((domTiddler.tagName || "").toLowerCase() !== "a")) {
		domTiddler = domTiddler.parentNode;
	}
	if(domTiddler && document.location.toString() === domTiddler.href.toString()) {
		// Manually trigger the scroll; links to other location hashes within this document will tragger a hashchange event
		scrollToTiddler(domTiddler.href.toString().split("#")[1]);
	}
	// Check for clicking on a thumbnail
	domTiddler = e.target;
	if(!document.body.classList.contains("scrolled-bottom")) {
		while(domTiddler && (!domTiddler.classList || !domTiddler.classList.contains("tc-tiddler-frame"))) {
			domTiddler = domTiddler.parentNode;
		}
		if(domTiddler) {
			navigateTo(domTiddler.getAttribute("data-tiddler-title"));
			e.preventDefault();
			return false;
		}		
	}
}

function navigateTo(title) {
	if(window.location.hash.substr(1) === title) {
		// If the location hash is already correct, just scroll
		scrollToTiddler(title);
	} else {
		// If the location hash is different, force the scroll by changing it
		window.location.hash = "#" + title;
	}
}

function onHashChange() {
	scrollToTiddler(window.location.hash.substr(1));
}

function scrollToTiddler(title) {
	var index = tiddlerByTitle[title],
		scrollPos = 0;
	if(title in tiddlerByTitle) {
		scrollPos = tiddlerNormalPositions[index].y + tiddlerScrollOffset;
	}
	scrollTo(scrollPos);
}

function scrollTo(targetPos) {
	var startPos = window.scrollY,
		timeStart,
		timeElapsed;
	isAutoScrolling = true;
	window.requestAnimationFrame(function(time) {
		timeStart = time;
		scrollStep(time);
	});
	function scrollStep(time) {
		timeElapsed = time - timeStart;
		if(timeElapsed < duration) {
			var scrollPos = startPos + (targetPos - startPos) * easeInOutQuad(timeElapsed / duration);
			window.scrollTo(0, scrollPos);
			lastScrollPosition = scrollPos;
			updateScrollAnimation(lastScrollPosition);
			window.requestAnimationFrame(scrollStep)
		} else {
			window.scrollTo(0, targetPos);
			lastScrollPosition = targetPos;
			updateScrollAnimation(lastScrollPosition);
			isAutoScrolling = false;
		}
	}
}

// Thanks to https://github.com/gre/bezier-easing
function easeInOutQuad(t) {
	return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

})();
