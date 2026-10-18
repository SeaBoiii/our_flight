#!/usr/bin/env sh
# Builds assets/audio/music-bed.mp3 (61.78s) from the master song.
# Sections are cut 0.5s past each bar-line join so the 1s crossfades centre on 23.59 and 47.13;
# the louder climax and outro sections are gain-matched to the soft intro, then compressed
# and loudness-normalised so the bed holds one level.
set -e
cd "$(dirname "$0")/../assets/audio"
T=$(mktemp -d)
ffmpeg -y -loglevel error -ss 0      -t 24.09 -i untamable-love.mp3 -c:a pcm_s16le "$T/a.wav"
ffmpeg -y -loglevel error -ss 151.15 -t 24.54 -i untamable-love.mp3 -af volume=-10.8dB -c:a pcm_s16le "$T/b.wav"
ffmpeg -y -loglevel error -ss 206.85 -t 15.15 -i untamable-love.mp3 -af volume=-8.3dB -c:a pcm_s16le "$T/c.wav"
ffmpeg -y -loglevel error -i "$T/a.wav" -i "$T/b.wav" -i "$T/c.wav" -filter_complex \
  "[0][1]acrossfade=d=1:c1=tri:c2=tri[ab];[ab][2]acrossfade=d=1:c1=tri:c2=tri,acompressor=threshold=-26dB:ratio=2.5:attack=200:release=1500:makeup=2dB,loudnorm=I=-20:LRA=5:TP=-2,afade=t=in:d=0.4,afade=t=out:st=59.8:d=1.98,atrim=0:61.78" \
  -ar 44100 -c:a libmp3lame -b:a 256k music-bed.mp3
rm -rf "$T"
echo "wrote assets/audio/music-bed.mp3"
