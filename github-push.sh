#!/bin/bash

# Deploy latest build to github

pushd ../jermolene-blog.github.io

git add --all || exit 1

git commit -m "Updates" || exit 1

git push origin || exit 1

popd
