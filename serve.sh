#!/bin/bash

# Serve TiddlyWiki

# Regenerate the tiddlers listing the toys in static-assets/toys
node "$(dirname "$0")/build-toys.js"

tiddlywiki main-wiki-server/ --server
