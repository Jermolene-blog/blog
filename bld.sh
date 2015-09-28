#!/bin/bash

# build all output

rm main-wiki/output/static/*
rm talkytalky-wiki/output/static/*

tiddlywiki main-wiki --verbose --build

rm main-wiki/output/cecily/index.html
mv main-wiki/output/cecily/cecily.html main-wiki/output/cecily/index.html

tiddlywiki talkytalky-wiki --verbose --build index
