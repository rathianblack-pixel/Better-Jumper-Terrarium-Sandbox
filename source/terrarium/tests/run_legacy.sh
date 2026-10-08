#!/bin/sh
# Runs the original Jumper Terrarium node test suite against a built index.html. Usage: sh tests/run_legacy.sh dist/jumper-terrarium/index.html
G=$(realpath "$1"); OUT=${2:-/tmp/legacy}; mkdir -p $OUT
for f in sim scenarios hunting species hybrids personality tanks terrain coinfree critter_paths decor_clearance camera biomes groundcover growth_away; do
  extra=""; case $f in critter_paths|decor_clearance) extra="--quick";; esac
  ( cd /data/terrarium/tests/legacy && GAME=$G timeout 900 node $f.js $G $extra > $OUT/$f.out 2>&1; echo "$f exit=$?" )
done
