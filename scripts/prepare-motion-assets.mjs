// Turns the generated motion masters in artwork/video/ into the phone delivery
// files. Requires ffmpeg on PATH. Run: node scripts/prepare-motion-assets.mjs
//
//   takeoff-portrait-master.mp4     -> public/flight/takeoff/takeoff-portrait-NN.webp
//       40 evenly spaced 540 x 960 frames, scrubbed on a canvas (src/filmStrip.ts)
//   window-sky-portrait-master.mp4  -> public/flight/window-sky-portrait.mp4
//       a seamless loop: the clip's first seconds are cross-faded over its last
//   golden-arrival-portrait-master.mp4 -> public/flight/golden-arrival-portrait.mp4
//       the same kind of loop, for the sky behind the monogram
//   venue-map-loop-master.mp4       -> public/flight/venue-map-loop.mp4
//   cruise-loop-master.mp4          -> public/flight/cruise-loop.mp4
//       the living paper model in Getting here (first frame equals last)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = (name) => `${root}artwork/video/${name}`;
const run = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());

// Keep these in step with takeoffFilm in src/sceneAssets.ts.
const FRAMES = 40;
const FRAME_SIZE = '540:960';
// Seconds trimmed from each end of the take-off master (model warm-up/settle).
const TAKEOFF_TRIM = { start: Number(process.env.TAKEOFF_START ?? 0), end: Number(process.env.TAKEOFF_END ?? 0) };

const takeoff = source('takeoff-portrait-master.mp4');
const frames = `${root}public/flight/takeoff/`;
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const usable = duration(takeoff) - TAKEOFF_TRIM.start - TAKEOFF_TRIM.end;
run(['-ss', String(TAKEOFF_TRIM.start), '-t', String(usable), '-i', takeoff,
  '-vf', `fps=${FRAMES}/${usable},scale=${FRAME_SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${FRAME_SIZE}`,
  '-frames:v', String(FRAMES), '-c:v', 'libwebp', '-quality', '64', '-compression_level', '6',
  '-start_number', '1', `${frames}takeoff-portrait-%02d.webp`]);

// A seamless loop: the clip's first seconds are cross-faded over its last.
const loop = (master, output, crf) => {
  const length = duration(master);
  const overlap = 1.5;
  run(['-i', master, '-an', '-filter_complex',
    `[0:v]fps=24,scale=${FRAME_SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${FRAME_SIZE},split[a][b];`
    + `[a]trim=${overlap}:${length},setpts=PTS-STARTPTS[main];[b]trim=0:${overlap},setpts=PTS-STARTPTS[head];`
    + `[main][head]xfade=transition=fade:duration=${overlap}:offset=${length - 2 * overlap},format=yuv420p[out]`,
    '-map', '[out]', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-crf', String(crf),
    '-g', '48', '-movflags', '+faststart', output]);
  return statSync(output).size;
};
const skyBytes = loop(source('window-sky-portrait-master.mp4'), `${root}public/flight/window-sky-portrait.mp4`, 27);
const goldenBytes = loop(source('golden-arrival-portrait-master.mp4'), `${root}public/flight/golden-arrival-portrait.mp4`, Number(process.env.GOLDEN_CRF ?? 27));

// The venue map was generated with the same first and last frame, so it loops
// as it is: only the duplicated final frame is dropped.
const mapMaster = source('venue-map-loop-master.mp4');
const mapOutput = `${root}public/flight/venue-map-loop.mp4`;
run(['-i', mapMaster, '-an', '-t', String(duration(mapMaster) - 1 / 24), '-vf', 'fps=24,scale=800:600:flags=lanczos,format=yuv420p',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-crf', '27', '-g', '48', '-movflags', '+faststart', mapOutput]);

// The itinerary cruise was generated the same way: first frame equals last.
const cruiseMaster = source('cruise-loop-master.mp4');
const cruiseOutput = `${root}public/flight/cruise-loop.mp4`;
run(['-i', cruiseMaster, '-an', '-t', String(duration(cruiseMaster) - 1 / 24), '-vf', 'fps=24,scale=640:480:flags=lanczos,format=yuv420p',
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-crf', String(process.env.CRUISE_CRF ?? 22), '-g', '48', '-movflags', '+faststart', cruiseOutput]);

const total = readdirSync(frames).reduce((sum, name) => sum + statSync(`${frames}${name}`).size, 0);
console.log(`take-off film: ${readdirSync(frames).length} frames, ${total.toLocaleString()} bytes`);
console.log(`window sky loop: ${skyBytes.toLocaleString()} bytes`);
console.log(`golden arrival loop: ${goldenBytes.toLocaleString()} bytes`);
console.log(`venue map loop: ${statSync(mapOutput).size.toLocaleString()} bytes`);
console.log(`cruise loop: ${statSync(cruiseOutput).size.toLocaleString()} bytes`);
