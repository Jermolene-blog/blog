/*\
title: $:/plugins/tiddlywiki/static/components/top-menu/top-menu.js
type: application/javascript
tags: $:/tags/Static/JS
component: top-menu

Polyfill for position: sticky;

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var lastScrollPosition = 0,
  	isWaitingForAnimationFrame = false,
	domMenu,
	domSpacer,
	topMenu,
	heightMenu,
	currentDropdown = null,
	currentDropdownTrigger = null;

// Kick things off when the page has loaded
window.addEventListener("load",onLoad,false);

function onLoad() {
	// Find the menu
	domMenu = document.querySelector("nav.tc-hamburger-menu");
	domSpacer = document.createElement("div");
	domMenu.parentNode.insertBefore(domSpacer,domMenu);
	domSpacer.style.width = "100%";
	onResize();
	// Attach our event listeners
	window.addEventListener("resize",onResize,false);
	window.addEventListener("scroll",onScroll,false);
	window.addEventListener("click",onClick,false);
}

function onResize(e) {
	domSpacer.style.height = "0";
	domMenu.style.position = "static";
	topMenu = domMenu.offsetTop;
	heightMenu = domMenu.offsetHeight;
	lastScrollPosition = window.scrollY;
	domMenu.style.position = "absolute";
	domMenu.style.top = topMenu + "px";
	domMenu.style.left = "0";
	domMenu.style.right = "0";
	domSpacer.style.height = heightMenu + "px";
	// Update the scroll animation
	updateScrollAnimation(lastScrollPosition);
	// Reposition the dropdown
	repositionDropdown();
}

function onScroll(e) {
	lastScrollPosition = window.scrollY;
	triggerAnimationFrame();
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

function updateScrollAnimation(scrollPos) {
	repositionDropdown();
	if(scrollPos <= topMenu) {
		domMenu.style.position = "absolute";
		domMenu.style.top = topMenu + "px";
		domMenu.style.left =  "0";
		domMenu.style.right =  "0";
	} else {
		domMenu.style.position = "fixed";
		domMenu.style.top = "0";
		domMenu.style.left = "0";
		domMenu.style.right = "0";
	}
}

function onClick(e) {
	// Look for a dropdown trigger
	var trigger = findAncestorWithClass(e.target,"tc-dropdown-trigger");
	if(trigger) {
		// Get the target title and trigger it
		displayDropdown(trigger);
		e.preventDefault();
		return false;
	}
	// Cancel the dropdown unless within a dropdown-keep zone
	if(currentDropdown) {
		var keep = findAncestorWithClass(e.target,"tc-dropdown-keep");
		if(!keep) {
			removeDropdown();
		}		
	}
}

function displayDropdown(trigger) {
	var title = trigger.getAttribute("data-dropdown-title"),
		newDropdown = findDropdown(title);
	if(newDropdown) {
		var oldDropdown = currentDropdown;
		if(currentDropdown) {
			removeDropdown();
		}
		if(newDropdown !== oldDropdown) {
			currentDropdown = newDropdown;
			currentDropdownTrigger = trigger;
			currentDropdown.style.left = "0";
			currentDropdown.style.display = "block";
			var widthDropdown = currentDropdown.offsetWidth,
				widthPage = currentDropdown.parentNode.offsetWidth,
				posTrigger = trigger.offsetLeft,
				posDropdown = posTrigger;
			if((posDropdown + widthDropdown) > widthPage) {
				posDropdown = widthPage - widthDropdown;
			}
			currentDropdown.style.left = posDropdown + "px";
			currentDropdown.style.maxHeight = "0";
			// currentDropdown.style.transition = "max-height 250ms ease-in-out";
			currentDropdownTrigger.classList.add("tc-dropdown-trigger-selected");
			repositionDropdown();
		}
	}

}

function removeDropdown() {
	if(currentDropdown) {
		if(currentDropdownTrigger) {
			currentDropdownTrigger.classList.remove("tc-dropdown-trigger-selected");
		}
		currentDropdown.style.maxHeight = "0";
		currentDropdown = null;
		currentDropdownTrigger = null;
	}
}

function findDropdown(title) {
	var dropdowns = document.querySelectorAll(".tc-hamburger-menu-dropdown"),
		dropdown = null;
	for(var n=0; n<dropdowns.length; n++) {
		if(dropdowns[n].getAttribute("data-dropdown-title") === title) {
			dropdown = dropdowns[n];
		}
	}
	return dropdown;
}

function repositionDropdown() {
	if(currentDropdown) {
		var dropdownClientRect = currentDropdown.getBoundingClientRect();
		currentDropdown.style.maxHeight = (window.innerHeight - dropdownClientRect.top - 8) + "px";			
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
