#!/bin/bash

rm -Rf ../jermolene-blog.github.io/*

cp -R main-wiki/output/* ../jermolene-blog.github.io/

mkdir -p ../jermolene-blog.github.io/talkytalky/

cp -R talkytalky-wiki/output/* ../jermolene-blog.github.io/talkytalky/

cp -R static-assets/* ../jermolene-blog.github.io/
