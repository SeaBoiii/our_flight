import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const execFileAsync = promisify(execFile);
const workspace = fileURLToPath(new URL('../', import.meta.url));
const root = resolve(workspace, process.env.ARTIFACT_DIR || 'dist');
const originalMonogramSha256 = '1002106cac61fb895c9b2f85fefbb464ba9cdf23c64571ddccb66c96fce4f734';
const textExtensions = new Set(['.css', '.env', '.gs', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.txt', '.yaml', '.yml']);

const artifactPatterns = [
  { label: 'legacy private API route', pattern: /\/api\/v1\/(?:unlock|invitation|rsvp|calendar)/i },
  { label: 'legacy private API configuration', pattern: /VITE_API_ORIGIN/i },
  { label: 'server-only signing secret name', pattern: /(?:ACCESS_TOKEN_SIGNING_SECRET|SESSION_SIGNING_SECRET)/i },
  { label: 'server-only ingestion secret name', pattern: /(?:APPS_SCRIPT_SHARED_SECRET|INGEST_SECRET)/i },
  { label: 'Google spreadsheet identifier', pattern: /docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}/i },
  { label: 'bare Google spreadsheet identifier', pattern: /(?:SPREADSHEET_ID|VITE_SPREADSHEET_ID)\s*[:=]\s*["'`][A-Za-z0-9_-]{20,}["'`]/i },
  { label: 'raw invitation hash route', pattern: /#\/i\/[A-Za-z0-9_-]{20,160}/i },
];

const configuredCodeHashes = new Set([
  process.env.INVITE_CODE_HASH_ECONOMY,
  process.env.INVITE_CODE_HASH_PREMIUM,
  process.env.INVITE_CODE_HASH_BUSINESS,
  process.env.INVITE_CODE_HASH_FIRST,
  process.env.INVITE_CODE_HASH_BRIDE_ECONOMY,
  process.env.INVITE_CODE_HASH_BRIDE_PREMIUM,
  process.env.INVITE_CODE_HASH_BRIDE_BUSINESS,
  process.env.INVITE_CODE_HASH_BRIDE_FIRST,
].filter((value) => /^[a-f0-9]{64}$/i.test(value ?? '')).map((value) => value.toLowerCase()));
const configuredLegacyTokenHashes = new Set([
  process.env.INVITE_TOKEN_HASH_ECONOMY,
  process.env.INVITE_TOKEN_HASH_PREMIUM,
  process.env.INVITE_TOKEN_HASH_BUSINESS,
  process.env.INVITE_TOKEN_HASH_FIRST,
].filter((value) => /^[a-f0-9]{64}$/i.test(value ?? '')).map((value) => value.toLowerCase()));
const configuredPasscodeHash = /^[a-f0-9]{64}$/i.test(process.env.WEDDING_PASSCODE_HASH ?? '')
  ? process.env.WEDDING_PASSCODE_HASH.toLowerCase()
  : '';

const sourceSecretPatterns = [
  {
    label: 'raw passcode assignment',
    pattern: /(?:WEDDING_PASSCODE|VITE_PASSCODE)(?!_HASH)\s*[:=]\s*["'`][^"'`\r\n]{4,}["'`]/i,
  },
  {
    label: 'raw invitation-token assignment',
    pattern: /(?:INVITE_TOKEN_(?:ECONOMY|PREMIUM|BUSINESS|FIRST)|(?:invite|invitation)Token)\s*[:=]\s*["'`][A-Za-z0-9_-]{20,160}["'`]/i,
  },
  {
    label: 'raw invitation-code assignment',
    pattern: /(?:INVITE_CODE_(?:BRIDE_)?(?:ECONOMY|PREMIUM|BUSINESS|FIRST)(?!_HASH)|(?:invite|invitation)Code)\s*[:=]\s*["'`][A-Za-z0-9 -]{8,24}["'`]/i,
  },
  {
    label: 'hard-coded server secret',
    pattern: /(?:INGEST_SECRET|APPS_SCRIPT_SHARED_SECRET|SESSION_SIGNING_SECRET)\s*[:=]\s*["'`][A-Za-z0-9_+/=-]{20,}["'`]/i,
  },
  {
    label: 'Google spreadsheet identifier',
    pattern: /docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}/i,
  },
  {
    label: 'bare Google spreadsheet identifier',
    pattern: /(?:SPREADSHEET_ID|VITE_SPREADSHEET_ID)\s*[:=]\s*["'`][A-Za-z0-9_-]{20,}["'`]/i,
  },
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function trackedSourceFiles() {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files'], { cwd: workspace, encoding: 'utf8' });
    return stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((name) => join(workspace, name))
      .filter((path) => textExtensions.has(extname(path).toLowerCase()));
  } catch {
    return [];
  }
}

async function localReleaseValues() {
  const values = [];
  for (const name of ['invite-access.txt', 'class-codes.txt']) {
    const releaseFile = join(workspace, '.private', name);
    if (!(await exists(releaseFile))) continue;
    const text = await readFile(releaseFile, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*(?:Initial shared passcode|Economy token|Premium Economy token|Business token|First Class token|(?:Bride |Groom )?Economy code|(?:Bride |Groom )?Premium Economy code|(?:Bride |Groom )?Business code|(?:Bride |Groom )?First Class code)\s*:\s*(\S+)\s*$/i.exec(line);
      if (match?.[1]) values.push(match[1]);
      for (const route of line.matchAll(/#\/i\/([A-Za-z0-9_-]{20,160})/g)) values.push(route[1]);
    }
  }
  return [...new Set(values.filter((value) => value.length >= 4))];
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function containsConfiguredRawCode(text) {
  for (const match of text.matchAll(/\b(?:AN|NUR)(?:[-\s]?[A-Z0-9]){6,12}\b/gi)) {
    const canonical = match[0].normalize('NFKC').trim().toUpperCase()
      .replace(/[\s\u002D\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+/g, '');
    if (configuredCodeHashes.has(hash(Buffer.from(canonical)))) return true;
  }
  return false;
}

function containsConfiguredLegacyToken(text) {
  for (const match of text.matchAll(/[A-Za-z0-9_-]{20,160}/g)) {
    if (configuredLegacyTokenHashes.has(hash(Buffer.from(match[0])))) return true;
  }
  return false;
}

function containsConfiguredPasscode(text) {
  if (!configuredPasscodeHash) return false;
  for (const match of text.matchAll(/["'`]([^"'`\\\r\n]{4,160})["'`]/g)) {
    if (hash(Buffer.from(match[1])) === configuredPasscodeHash) return true;
  }
  return false;
}

const files = await filesIn(root);
const failures = [];
const releaseValues = await localReleaseValues();

for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/');
  if (name.endsWith('.map')) failures.push(`Source map present: ${name}`);
  if (/an-monogram\.svg$/i.test(name)) failures.push(`Obsolete geometric monogram present: ${name}`);

  const bytes = await readFile(file);
  for (const value of releaseValues) {
    if (bytes.includes(Buffer.from(value))) failures.push(`A private release value is present in ${name}.`);
  }
  if (!textExtensions.has(extname(file).toLowerCase())) continue;
  const text = bytes.toString('utf8').normalize('NFKC');
  if (containsConfiguredRawCode(text)) failures.push(`A raw invitation code is present in ${name}.`);
  if (containsConfiguredLegacyToken(text)) failures.push(`A raw legacy invitation token is present in ${name}.`);
  if (containsConfiguredPasscode(text)) failures.push(`The raw legacy passcode is present in ${name}.`);
  for (const { label, pattern } of artifactPatterns) {
    if (pattern.test(text)) failures.push(`${label} found in ${name}.`);
  }
}

for (const file of await trackedSourceFiles()) {
  const name = relative(workspace, file).replaceAll('\\', '/');
  const text = (await readFile(file, 'utf8')).normalize('NFKC');
  if (containsConfiguredRawCode(text)) failures.push(`A raw invitation code is present in tracked source ${name}.`);
  if (containsConfiguredLegacyToken(text)) failures.push(`A raw legacy invitation token is present in tracked source ${name}.`);
  if (containsConfiguredPasscode(text)) failures.push(`The raw legacy passcode is present in tracked source ${name}.`);
  for (const value of releaseValues) {
    if (text.includes(value)) failures.push(`A private release value is present in tracked source ${name}.`);
  }
  if (name.startsWith('src/test/')) continue;
  for (const { label, pattern } of sourceSecretPatterns) {
    if (pattern.test(text)) failures.push(`${label} found in tracked source ${name}.`);
  }
}

for (const monogramPath of [
  join(workspace, 'public', 'monogram-a-and-n.png'),
  join(root, 'monogram-a-and-n.png'),
]) {
  if (!(await exists(monogramPath))) {
    failures.push(`Original A&N monogram missing: ${relative(workspace, monogramPath)}.`);
    continue;
  }
  const bytes = await readFile(monogramPath);
  if (hash(bytes) !== originalMonogramSha256) {
    failures.push(`Original A&N monogram was modified: ${relative(workspace, monogramPath)}.`);
  }
  if (bytes.readUInt32BE(16) !== 768 || bytes.readUInt32BE(20) !== 512) {
    failures.push(`Original A&N monogram dimensions changed: ${relative(workspace, monogramPath)}.`);
  }
}

for (const requiredAsset of ['favicon.png', 'monogram-a-and-n-display.png', 'og.jpg']) {
  if (!(await exists(join(root, requiredAsset)))) failures.push(`Required brand asset missing: ${requiredAsset}.`);
}

const cloudVideoPath = join(root, 'journey', 'clouds-ping-pong.mp4');
const cloudPosterPath = join(root, 'journey', 'clouds-video-poster.webp');
if (!(await exists(cloudVideoPath))) {
  failures.push('Required cloud video missing: journey/clouds-ping-pong.mp4.');
} else if ((await stat(cloudVideoPath)).size > 10 * 1024 * 1024) {
  failures.push('Cloud video exceeds the 10 MiB mobile delivery budget.');
}
if (!(await exists(cloudPosterPath))) {
  failures.push('Required cloud video poster missing: journey/clouds-video-poster.webp.');
}

const indexHtml = await readFile(join(root, 'index.html'), 'utf8');
if (/__[A-Z][A-Z0-9_]+__|%BASE_URL%/.test(indexHtml)) failures.push('Unresolved build placeholder found in index.html.');
if (/journey\/(?:cabin|clouds)-/i.test(indexHtml)) failures.push('Cinematic assets must not be loaded by the locked-page HTML.');
if (!/rel="icon"[^>]+favicon\.png/.test(indexHtml)) failures.push('The restored A&N favicon is not referenced by index.html.');

const initialAssetNames = [...indexHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png))"/g)]
  .map((match) => basename(match[1]));
for (const brandAsset of ['monogram-a-and-n.png', 'monogram-a-and-n-display.png']) {
  if (files.some((file) => basename(file) === brandAsset)) initialAssetNames.push(brandAsset);
}
const uniqueInitialAssets = [...new Set(initialAssetNames)];
let initialBytes = Buffer.byteLength(indexHtml);
for (const asset of uniqueInitialAssets) {
  const match = files.find((file) => basename(file) === asset);
  if (match) initialBytes += (await stat(match)).size;
}
if (initialBytes > 500 * 1024) failures.push(`Initial transfer estimate is ${initialBytes} bytes (limit 512000).`);

const initialScripts = uniqueInitialAssets.filter((asset) => asset.endsWith('.js'));
if (!initialScripts.length) failures.push('Initial JavaScript asset was not found in index.html.');
let initialScriptGzipBytes = 0;
for (const script of initialScripts) {
  const match = files.find((file) => basename(file) === script);
  if (match) initialScriptGzipBytes += gzipSync(await readFile(match)).length;
}
if (initialScriptGzipBytes > 150 * 1024) {
  failures.push(`Initial JavaScript is ${initialScriptGzipBytes} gzip bytes (limit 153600).`);
}

if (failures.length) {
  console.error([...new Set(failures)].join('\n'));
  process.exit(1);
}

console.log(
  `Artifact check passed: ${files.length} files, ${initialBytes} estimated initial bytes, ${initialScriptGzipBytes} gzip JS bytes.`,
);
