#!/usr/bin/env bash
# How assets/bear.glb was made from the Sketchfab download (scene.gltf + scene.bin + textures/).
# Only needed if the source model changes. Requires Node; installs glTF-Transform 4.x on demand.
#
#   1. metalrough  the model uses KHR_materials_pbrSpecularGlossiness, which three.js no longer
#                  loads; convert to standard metal/rough PBR
#   2. resample    drop redundant animation keyframes (81 clips; 13 MB -> 8 MB)
#   3. webp        WebP textures at quality 90 (8 MB -> 5.4 MB)
#
# Usage: tools/convert_model.sh path/to/scene.gltf
set -euo pipefail
src="${1:?path to scene.gltf}"
tmp="$(mktemp -d)"
npx -y @gltf-transform/cli@4 metalrough "$src" "$tmp/a.glb"
npx -y @gltf-transform/cli@4 resample "$tmp/a.glb" "$tmp/b.glb"
npx -y @gltf-transform/cli@4 webp "$tmp/b.glb" "$(dirname "$0")/../assets/bear.glb" --quality 90
rm -rf "$tmp"
echo "wrote assets/bear.glb — now run: python3 tools/build.py"
