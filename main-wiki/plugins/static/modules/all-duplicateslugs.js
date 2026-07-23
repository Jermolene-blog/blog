/*\
title: $:/plugins/tiddlywiki/static/filters/all/duplicateslugs.js
type: application/javascript
module-type: allfilteroperator

Filter function for [all[duplicateslugs]]

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var slugify = require("$:/plugins/tiddlywiki/static/slugify.js");

/*
Export our filter function
*/
exports.duplicateslugs = function(source,prefix,options) {
	var slugs = {},
		duplicates = [];
	options.wiki.allTitles().forEach(function(title) {
		var slugifiedTitle = slugify.slugify(options.wiki,title);
		if(slugs[slugifiedTitle]) {
			if(slugs[slugifiedTitle].length === 1) {
				duplicates.push(slugs[slugifiedTitle][0]);
			}
			duplicates.push(title);
			slugs[slugifiedTitle].push(title);
		} else {
			slugs[slugifiedTitle] = [title];
		}
	});
	return duplicates;
};

})();
