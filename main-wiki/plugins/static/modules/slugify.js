/*\
title: $:/plugins/tiddlywiki/static/slugify.js
type: application/javascript
module-type: library

Function to convert a tiddler title into a slug

From https://gist.github.com/mathewbyrne/1280286

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

exports.slugify = function(wiki,title) {
	var tiddler = wiki.getTiddler(title),
		slug;
	if(tiddler && tiddler.fields.slug) {
		slug = tiddler.fields.slug;
	} else {
		slug = $tw.utils.transliterate(title.toString().toLowerCase()) // Replace diacritics with basic lowercase ASCII
			.replace(/\s+/g,"-")                                       // Replace spaces with -
			.replace(/[^\w\-\.]+/g,"")                                 // Remove all non-word chars except dash and dot
			.replace(/\-\-+/g,"-")                                     // Replace multiple - with single -
			.replace(/^-+/,"")                                         // Trim - from start of text
			.replace(/-+$/,"");                                        // Trim - from end of text
	}
	// If the resulting slug is blank (eg because the title is just punctuation characters)
	if(!slug) {
		// ...then just use the character codes of the title
		slug = title.split("").map(function(char) {
			return char.charCodeAt(0).toString();
		}).join("-");
	}
	return slug;
};

})();
