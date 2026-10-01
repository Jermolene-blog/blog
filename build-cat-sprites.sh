#!/bin/bash

# Cut the cats out of their studio photographs to make the sprites used by
# static-assets/toys/marble-flick/cat-actor.js, and the photograph that
# cat-puppet.js drapes over its skeleton
#
# Each photograph listed below is lifted from its white background with the
# macOS Vision framework (the same subject lifting as Preview and Photos), has
# the bright fringe trimmed from its edges, and is cropped, scaled so that every
# cat comes out at the same size, and saved as a WebP with transparency.
#
# The results are committed, so this only needs running to add or change a pose.
# After adding one, give it an entry in POSES at the top of cat-actor.js using
# the sprite size that this script prints. The puppet's rig in cat-puppet.js is
# measured in pixels of its photograph, so changing that means re-measuring it.
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
PUPPET="$ROOT/static-assets/toys/marble-flick/cat-puppet"
WORK="${TMPDIR:-/tmp}/build-cat-sprites"

# Sprite pixels in the height of the seated cat. Must match UNIT in cat-actor.js
UNIT=560
# Transparent margin kept around each cat, in pixels of the 2400 pixel working copy
PAD=14

# name, photograph, height relative to the seated cat, and optionally a crop of
# the 2400 pixel working copy (the default is the bounds of the cat). Poses that
# are cut between, like loaf and yawn, share a crop so that they stay registered.
# A photograph is named by the start of its filename, whatever its extension, so
# that Finder's copies ("IMG_0032 2.PNG") are found too
poses() { cat <<'EOF'
sit IMG_0032 1.00
beg IMG_0033 1.22
look-up IMG_0037 1.04
look-away IMG_0035 1.04
look-down IMG_0036 1.00
loaf IMG_0002 0.66 1540x1177+760+277
yawn IMG_0003 0.66 1540x1177+760+277
lounge IMG_0005 0.52
groom IMG_0031 0.80
roll IMG_6224 0.66
paw-down IMG_6438 1.06
paw-up IMG_6441 1.06
upright IMG_6434 1.10
pair IMG_0004 1.05
stroll IMG_0020 0.95
EOF
}

# The photographs that cat-puppet.js drapes over its skeletons, and the face of
# the cat in the hole: name, photograph, crop at the camera's full size, and
# width of the result. Anything after that is a polygon to keep, in pixels of the
# result, which fades out at its edge: it trims the face from its neck and body
puppets() { cat <<'EOF'
walker IMG_6077 2595x1651+1486+659 1200
arm IMG_6242 780x1331+2994+2040 400
upright IMG_6457 3030x2907+1135+535 1010
face IMG_1613 2266x2266+836+559 512 55,0 140,0 250,62 335,62 425,8 492,8 502,120 486,300 446,400 335,468 232,468 112,404 22,334 8,200 58,92
EOF
}

photo() {
	find "$SRC" -maxdepth 1 -type f -name "$1*" ! -iname "*.mov" | sort | head -1
}

mkdir -p "$WORK" "$OUT" "$PUPPET"

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
	sips -s format png -Z 2400 "$(photo "$photo")" --out "$WORK/$name-src.png" > /dev/null
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

# The puppets are worked at full size, as they are shown much larger than the
# sprites. Each is wrapped up as a script handing over a data: URL, because WebGL
# will not take an image file from a page that has been opened straight from the disk
puppets | while read -r name photo crop width keep; do
	sips -s format png "$(photo "$photo")" --out "$WORK/$name-src.png" > /dev/null
	"$WORK/matte" "$WORK/$name-src.png" "$WORK/$name-cut.png"
	magick "$WORK/$name-cut.png" \( +clone -alpha extract -blur 0x4 -level 55%,100% \) -alpha off -compose CopyOpacity -composite -crop "$crop" +repage -resize "${width}x" "PNG32:$WORK/$name.png"
	if [ -n "$keep" ]; then
		magick "$WORK/$name.png" \( +clone -alpha extract \( +clone -fill black -colorize 100 -fill white -draw "polygon $keep" -blur 0x10 \) -compose Multiply -composite \) -alpha off -compose CopyOpacity -composite "PNG32:$WORK/$name.png"
	fi
	cwebp -quiet -q 86 -alpha_q 95 -m 6 "$WORK/$name.png" -o "$WORK/$name.webp"
	{
		printf '// A photograph for cat-puppet.js. Generated by build-cat-sprites.sh\nCatPuppet.photograph("%s", "data:image/webp;base64,' "$name"
		base64 -i "$WORK/$name.webp" | tr -d '\n'
		printf '");\n'
	} > "$PUPPET/$name.js"
	echo "$name: $(magick identify -format '%wx%h' "$WORK/$name.png")"
done
