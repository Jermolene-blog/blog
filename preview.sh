#!/bin/bash

# Serve the static site in site/ at http://127.0.0.1:8080, building it first
# (the pages use root-relative URLs, so they cannot be viewed directly from the
# filesystem). Pass --no-build to serve the existing build

cd "$(dirname "$0")" || exit 1

if lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1; then
	echo "Port 8080 is already in use (is serve.sh running?)"
	exit 1
fi

if [ "$1" != "--no-build" ]; then
	./bld.sh || exit 1
fi

echo "Serving the static site at http://127.0.0.1:8080/ (Ctrl-C to stop)"
python3 -m http.server 8080 --bind 127.0.0.1 --directory site
