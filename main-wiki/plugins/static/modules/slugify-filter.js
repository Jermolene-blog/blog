/*\
title: $:/plugins/tiddlywiki/static/filters/slugify.js
type: application/javascript
module-type: filteroperator

Filter operator for slugifying a tiddler title

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var slugify = require("$:/plugins/tiddlywiki/static/slugify.js");

/*
Export our filter functions
*/

exports.slugify = function(source,operator,options) {
	var results = [];
	source(function(tiddler,title) {
		results.push(slugify.slugify(options.wiki,title));
	});
	return results;
};

})();
