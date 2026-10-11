#!/bin/bash
# Re-renders all intro films + menu loops into packs/terrarium/static/intro (needs node, playwright, ffmpeg).
set -e; cd "$(dirname "$0")"; mkdir -p out; D=../packs/terrarium/static/intro; mkdir -p $D
node music-render.js
for st in hd2d cuphead storybook; do for or in landscape portrait; do
  node render.js $st $or intro out/v-intro-$st-$or.mp4
  node render.js $st $or loop  out/v-loop-$st-$or.mp4
  ffmpeg -v error -y -i out/v-intro-$st-$or.mp4 -i out/music-$st.wav -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000" -c:a aac -b:a 192k -shortest -movflags +faststart $D/intro-$st-$or.mp4
  cp out/v-loop-$st-$or.mp4 $D/loop-$st-$or.mp4
done; done
echo "done -> $D"
