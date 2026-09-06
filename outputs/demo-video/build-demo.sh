#!/bin/zsh
set -euo pipefail

out="outputs/demo-video"
work="$out/work"
common=(-c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart)
base="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf6f7fb,fps=30"

ffmpeg -y -hide_banner -loglevel warning \
  -i "/Users/olsadomi/Desktop/Screen Recording 2026-09-06 at 10.27.32.mov" -i "$out/audio/01-admin.mp3" \
  -filter_complex "[0:v]setpts=PTS/2.2,${base}[v];[1:a]adelay=1500|1500,apad[a]" \
  -map "[v]" -map "[a]" -shortest "${common[@]}" "$work/01-admin.mp4"

ffmpeg -y -hide_banner -loglevel warning \
  -i "/Users/olsadomi/Desktop/Screen Recording 2026-09-06 at 11.00.17.mov" -i "$out/audio/02-teacher.mp3" \
  -filter_complex "[0:v]setpts=PTS/1.8,${base}[v];[1:a]adelay=1500|1500,apad[a]" \
  -map "[v]" -map "[a]" -shortest "${common[@]}" "$work/02-teacher.mp4"

ffmpeg -y -hide_banner -loglevel warning \
  -i "/Users/olsadomi/Desktop/Screen Recording 2026-09-06 at 14.04.10.mov" -i "$out/audio/03-publish.mp3" \
  -filter_complex "[0:v]setpts=PTS/1.25,${base}[v];[1:a]adelay=1200|1200,apad[a]" \
  -map "[v]" -map "[a]" -shortest "${common[@]}" "$work/03-publish.mp4"

ffmpeg -y -hide_banner -loglevel warning \
  -i "/Users/olsadomi/Desktop/Screen Recording 2026-09-06 at 14.06.37.mov" -i "$out/audio/04-tools.mp3" \
  -filter_complex "[0:v]setpts=PTS/1.2,${base}[v];[1:a]adelay=1200|1200,apad[a]" \
  -map "[v]" -map "[a]" -shortest "${common[@]}" "$work/04-tools.mp4"

ffmpeg -y -hide_banner -loglevel warning \
  -i "/Users/olsadomi/Desktop/Screen Recording 2026-09-06 at 14.08.49.mov" -i "$out/audio/05-student.mp3" \
  -filter_complex "[0:v]split=3[v0][v1][v2];[v0]trim=start=0:end=230,setpts=(PTS-STARTPTS)/2.0,${base}[s0];[v1]trim=start=230:end=330,setpts=(PTS-STARTPTS)/8.0,${base}[s1];[v2]trim=start=330,setpts=(PTS-STARTPTS)/1.2,${base}[s2];[s0][s1][s2]concat=n=3:v=1:a=0[v];[1:a]adelay=1500|1500,apad[a]" \
  -map "[v]" -map "[a]" -shortest "${common[@]}" "$work/05-student.mp4"

ffmpeg -y -hide_banner -loglevel warning \
  -i "$work/01-admin.mp4" -i "$work/02-teacher.mp4" -i "$work/03-publish.mp4" -i "$work/04-tools.mp4" -i "$work/05-student.mp4" \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a]concat=n=5:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" "${common[@]}" "$out/mesolehte-demo-shkolla-albanian.mp4"

ffprobe -v error -show_entries format=filename,duration,size -of default=nw=1 "$out/mesolehte-demo-shkolla-albanian.mp4"
