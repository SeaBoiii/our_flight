import { createHash } from 'node:crypto';

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.error('Usage: npm run hash:code -- "YOUR-CLASS-CODE"');
  process.exit(1);
}

const canonical = input.normalize('NFKC').trim().toUpperCase()
  .replace(/[\s\u002D\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]+/g, '');
if (!/^[A-Z0-9]{8,12}$/.test(canonical)) {
  console.error('A normalized invitation code must contain 8–12 letters or numbers.');
  process.exit(1);
}

console.log(createHash('sha256').update(canonical).digest('hex'));
