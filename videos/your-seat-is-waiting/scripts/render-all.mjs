// Renders the trailer cuts in turn, then restores index.html to EN · 21 August (Clyde).
//   node scripts/render-all.mjs                             # all four cuts, Clyde
//   node scripts/render-all.mjs en-21 ms-21 --voice=george  # chosen cuts in the alternate voice
import { execSync } from 'node:child_process';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const args = process.argv.slice(2);
const voiceArg = args.find((a) => a.startsWith('--voice=')) || '';
const voice = voiceArg ? voiceArg.slice(8).toLowerCase() : 'clyde';
const picked = args.filter((a) => !a.startsWith('--'));
const cuts = picked.length ? picked : ['en-21', 'en-22', 'ms-21', 'ms-22'];
const suffix = voice === 'clyde' ? '' : `-${voice}`;
try {
  for (const cut of cuts) {
    run(`node scripts/cuts.mjs ${cut} ${voiceArg}`);
    run(`npx --yes hyperframes@0.8.167 render -q delivery -o renders/your-seat-is-waiting-${cut}${suffix}.mp4`);
  }
} finally {
  run('node scripts/cuts.mjs en-21');
}
