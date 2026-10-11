#!/bin/bash

# Render the PNG app icons for the toys index and each toy from the icon.svg
# in the same folder: icon-192.png and icon-512.png for the web app manifest
# and apple-touch-icon.png (180px) for iOS. The PNGs are committed, so this
# only needs running after an icon.svg is added or changed. Needs rsvg-convert
# (brew install librsvg)

cd "$(dirname "$0")" || exit 1

if ! command -v rsvg-convert >/dev/null 2>&1; then
	echo "build-icons: rsvg-convert not found (brew install librsvg)"
	exit 1
fi

for svg in static-assets/toys/icon.svg static-assets/toys/*/icon.svg; do
	[ -f "$svg" ] || continue
	dir="$(dirname "$svg")"
	rsvg-convert -w 192 -h 192 "$svg" -o "$dir/icon-192.png" || exit 1
	rsvg-convert -w 512 -h 512 "$svg" -o "$dir/icon-512.png" || exit 1
	rsvg-convert -w 180 -h 180 "$svg" -o "$dir/apple-touch-icon.png" || exit 1
	echo "build-icons: rendered $dir"
done
