#!/bin/bash

cp -R main-wiki/output/* ../jermolene-blog.github.io/

mkdir -p ../jermolene-blog.github.io/talkytalky/

cp -R talkytalky-wiki/output/* ../jermolene-blog.github.io/talkytalky/

# Make the CNAME file that GitHub Pages requires

echo "jermolene.com" > ../jermolene-blog.github.io/CNAME
