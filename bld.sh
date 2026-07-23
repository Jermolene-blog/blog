#!/bin/bash

# build all output

# Use the plugins vendored in this repo (tiddlywiki/blog and tiddlywiki/cecily
# were removed from the TiddlyWiki5 core repo)
export TIDDLYWIKI_PLUGIN_PATH="$(dirname "$0")/plugins"

rm -Rf main-wiki/output/*
rm -Rf talkytalky-wiki/output/*

tiddlywiki main-wiki --verbose --build

tiddlywiki talkytalky-wiki --verbose --build index
