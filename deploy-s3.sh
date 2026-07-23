#!/bin/bash

# Deploy the staged site to the jermolene.com S3 bucket
#
# Run ./bld.sh && ./stage.sh first

set -e

STAGED=../jermolene-blog.github.io
PROFILE=federatial

aws s3 sync "$STAGED" s3://jermolene.com/ --profile $PROFILE --exclude "CNAME" --exclude ".git/*"

# The rendered pages are extensionless so S3 cannot guess their content type;
# upload them again with it set explicitly
find "$STAGED" -type f ! -name "*.*" ! -path "*/.git/*" | while read -r f; do
	key="${f#$STAGED/}"
	aws s3 cp "$f" "s3://jermolene.com/$key" --profile $PROFILE --content-type "text/html; charset=utf-8"
done
