#!/bin/bash

# build all output

# Use the plugins vendored in this repo (tiddlywiki/blog and tiddlywiki/cecily
# were removed from the TiddlyWiki5 core repo)
export TIDDLYWIKI_PLUGIN_PATH="$(dirname "$0")/plugins"

rm -Rf main-wiki/output/*
rm -Rf talkytalky-wiki/output/*

# The talkytalky slides are built first so that they can be screenshotted
tiddlywiki talkytalky-wiki --verbose --build index

# Capture screenshots of any toys and other pages that have changed since
# their committed screenshots were taken
node "$(dirname "$0")/build-screenshots.js"

# Regenerate the tiddlers listing the toys in static-assets/toys
node "$(dirname "$0")/build-toys.js"

# Draw the social media cards of any toys, posts and pages that have changed
# since their committed cards were drawn
node "$(dirname "$0")/build-social.js"

tiddlywiki main-wiki --verbose --build

# The save command writes .meta sidecar files for binary tiddlers; they are
# not part of the published site
find main-wiki/output -name "*.meta" -delete

# Assemble the complete site in site/, laid out exactly as it is published.
# Static assets are copied last and overwrite the wiki output on conflict; the
# trailing /. copies dotfiles (.nojekyll) too
rm -Rf site
mkdir -p site/talkytalky
cp -R main-wiki/output/* site/
cp -R talkytalky-wiki/output/* site/talkytalky/
cp -R static-assets/. site/
find site -name ".DS_Store" -delete

# Give the toys the tags that show their cards when they are shared on social
# media. This is done before build-pwa.js so that the service worker's version
# covers the tags
node "$(dirname "$0")/build-social.js" --tags

# Generate the web app manifests, and write the precache list into the service
# worker, to make the toys installable, from the assembled site
node "$(dirname "$0")/build-pwa.js"
