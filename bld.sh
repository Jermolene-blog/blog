#!/bin/bash

# build all output

rm -Rf main-wiki/output/*
rm -Rf talkytalky-wiki/output/*

tiddlywiki main-wiki --verbose --build

tiddlywiki talkytalky-wiki --verbose --build index
