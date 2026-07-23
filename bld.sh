#!/bin/bash

# build all output

# Use the plugins vendored in this repo (tiddlywiki/blog and tiddlywiki/cecily
# were removed from the TiddlyWiki5 core repo)
export TIDDLYWIKI_PLUGIN_PATH="$(dirname "$0")/plugins"

rm -Rf main-wiki/output/*
rm -Rf talkytalky-wiki/output/*

tiddlywiki main-wiki --verbose --build

# The save command writes .meta sidecar files for binary tiddlers; they are
# not part of the published site
find main-wiki/output -name "*.meta" -delete

tiddlywiki talkytalky-wiki --verbose --build index
