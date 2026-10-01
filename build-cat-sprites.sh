#!/bin/bash

# Cut the cats out of their studio photographs to make the sprites used by
# static-assets/toys/marble-flick/cat-actor.js
#
# Each photograph listed below is lifted from its white background with the
# macOS Vision framework (the same subject lifting as Preview and Photos), has
# the bright fringe trimmed from its edges, and is cropped, scaled so that every
# cat comes out at the same size, and saved as a WebP with transparency.
#
# The sprites are committed, so this only needs running to add or change a pose.
# After adding one, give it an entry in POSES at the top of cat-actor.js using
# the sprite size that this script prints.
#
# Usage: ./build-cat-sprites.sh [<folder of original photographs>]
#
# The photographs are far too big to commit, and so by default are read from
# local/cats, which is ignored by git
#
# Needs macOS 14 or later with the Xcode command line tools (swiftc), and
# ImageMagick and cwebp (brew install imagemagick webp)

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$ROOT/local/cats}"
OUT="$ROOT/static-assets/toys/marble-flick/cat-sprites"
WORK="${TMPDIR:-/tmp}/build-cat-sprites"

# Sprite pixels in the height of the seated cat. Must match UNIT in cat-actor.js
UNIT=560
# Transparent margin kept around each cat, in pixels of the 2400 pixel working copy
PAD=14

# name, photograph, height relative to the seated cat, and optionally a crop of
# the 2400 pixel working copy (the default is the bounds of the cat). Poses that
# are cut between, like loaf and yawn, share a crop so that they stay registered
poses() { cat <<'EOF'
sit IMG_0032.PNG 1.00
beg IMG_0033.PNG 1.22
look-up IMG_0037.PNG 1.04
look-away IMG_0035.PNG 1.04
look-down IMG_0036.PNG 1.00
loaf IMG_0002.JPG 0.66 1540x1177+760+277
yawn IMG_0003.JPG 0.66 1540x1177+760+277
lounge IMG_0005.jpg 0.52
groom IMG_0031.PNG 0.80
roll IMG_6224.CR3 0.66
paw-down IMG_6438.CR3 1.06
paw-up IMG_6441.CR3 1.06
upright IMG_6434.CR3 1.10
pair IMG_0004.JPG 1.05
stroll IMG_0020.PNG 0.95
EOF
}

mkdir -p "$WORK" "$OUT"

cat > "$WORK/matte.swift" <<'EOF'
import Foundation
import Vision
import CoreImage

// matte <in> <out>: lift the foreground subjects out of an image, writing an RGBA PNG
let args = CommandLine.arguments
guard let image = CIImage(contentsOf: URL(fileURLWithPath: args[1]), options: [.applyOrientationProperty: true]) else { fatalError("cannot read \(args[1])") }
let handler = VNImageRequestHandler(ciImage: image)
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let result = request.results?.first else { fatalError("no subject found in \(args[1])") }
let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
try CIContext().writePNGRepresentation(of: CIImage(cvPixelBuffer: buffer), to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
EOF
swiftc -O "$WORK/matte.swift" -o "$WORK/matte"

poses | while read -r name photo rel crop; do
	# A 2400 pixel working copy (sips also reads the camera raw files)
	sips -s format png -Z 2400 "$SRC/$photo" --out "$WORK/$name-src.png" > /dev/null
	"$WORK/matte" "$WORK/$name-src.png" "$WORK/$name-cut.png"
	# Choke the mask by a couple of pixels to lose the backlit fringe
	magick "$WORK/$name-cut.png" \( +clone -alpha extract -blur 0x2.2 -level 55%,100% \) -alpha off -compose CopyOpacity -composite "$WORK/$name-clean.png"
	if [ -z "$crop" ]; then
		read -r w h x y <<< "$(magick identify -format '%@' "$WORK/$name-clean.png" | sed 's/[x+]/ /g')"
		x=$((x > PAD ? x - PAD : 0)); y=$((y > PAD ? y - PAD : 0))
		crop="$((w + 2 * PAD))x$((h + 2 * PAD))+$x+$y"
	fi
	height=$(awk "BEGIN { printf \"%d\", $UNIT * $rel + 0.5 }")
	magick "$WORK/$name-clean.png" -crop "$crop" +repage -resize "x$height" "PNG32:$WORK/$name.png"
	cwebp -quiet -q 82 -alpha_q 90 -m 6 "$WORK/$name.png" -o "$OUT/$name.webp"
	echo "$name: $(magick identify -format '%wx%h' "$WORK/$name.png")"
done
