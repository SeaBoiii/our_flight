import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const forbidden = [
  '21 August',
  '21 Ogos',
  'Nikah',
  'AN2108',
  'both-days',
  'PASSCODE_HASH',
  'ACCESS_TOKEN_SIGNING_SECRET',
  'APPS_SCRIPT_URL',
  'APPS_SCRIPT_SHARED_SECRET',
  'INVITE_TOKEN_',
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

const files = await filesIn(root);
const failures = [];

for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/');
  if (name.endsWith('.map')) failures.push(`Source map present: ${name}`);
  const bytes = await readFile(file);
  const text = bytes.toString('utf8').normalize('NFKC').toLowerCase();
  for (const phrase of forbidden) {
    const normalized = phrase.normalize('NFKC').toLowerCase();
    const found = phrase === 'Nikah'
      ? /(^|[^a-z])nikah([^a-z]|$)/.test(text)
      : text.includes(normalized);
    if (found) {
      failures.push(`Restricted literal found in ${name}: ${phrase}`);
    }
  }
}

const indexHtml = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const initialAssets = [...indexHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg))"/g)]
  .map((match) => basename(match[1]));
let initialBytes = Buffer.byteLength(indexHtml);
for (const asset of initialAssets) {
  const match = files.find((file) => basename(file) === asset);
  if (match) initialBytes += (await stat(match)).size;
}
if (initialBytes > 500 * 1024) failures.push(`Initial transfer estimate is ${initialBytes} bytes (limit 512000)`);

const initialScript = initialAssets.find((asset) => asset.endsWith('.js'));
if (!initialScript) failures.push('Initial JavaScript asset was not found in index.html');
if (initialScript) {
  const match = files.find((file) => basename(file) === initialScript);
  if (match) {
    const gzipBytes = gzipSync(await readFile(match)).length;
    if (gzipBytes > 150 * 1024) failures.push(`Initial JavaScript is ${gzipBytes} gzip bytes (limit 153600)`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Artifact check passed: ${files.length} files, ${initialBytes} estimated initial bytes.`);
