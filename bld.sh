#!/bin/bash

# build all output

rm main-wiki/output/static/*

tiddlywiki main-wiki --verbose --build
