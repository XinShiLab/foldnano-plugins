// Builds a plugin zip reproducibly and prints its registry.json entry.
//
//   node scripts/pack.mjs <plugin-folder> [--manifest <fplugin.json>] [--base <url>]
//
// The zip holds the folder's files plus the manifest as fplugin.json, without entrypointUrl (a
// listed zip is found through the listing, never through its own manifest). Entries are sorted
// and timestamped 1980-01-01, so the same files always give the same SHA-256.
//
// Writes plugins/<id>/<version>/<id>-<version>.zip and points zip.url at this repo's Pages site.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { DEFAULT_PAGES_BASE, ENTRY_MANIFEST_FIELDS, MAX_ZIP_BYTES } from './shared.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDE = /(^|\/)(__pycache__|\.[^/]*)(\/|$)|\.zip$|\.pyc$/;
// Zip timestamps are local wall-clock time, so build the date from local parts: same bytes in every
// time zone.
const FIXED_MTIME = new Date(1980, 0, 1);

function parseArgs(argv) {
	const args = { dir: null, manifest: null, base: DEFAULT_PAGES_BASE };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--manifest') args.manifest = argv[++i];
		else if (a === '--base') args.base = argv[++i];
		else if (!args.dir) args.dir = a;
		else throw new Error(`Unexpected argument ${a}`);
	}
	if (!args.dir) throw new Error('Usage: pack.mjs <plugin-folder> [--manifest <path>]');
	return args;
}

function collectFiles(dir, base = dir) {
	const out = {};
	for (const entry of readdirSync(dir).sort()) {
		const abs = join(dir, entry);
		const rel = relative(base, abs).split('\\').join('/');
		if (EXCLUDE.test(rel) || rel === 'fplugin.json') continue;
		if (statSync(abs).isDirectory()) Object.assign(out, collectFiles(abs, base));
		else out[rel] = new Uint8Array(readFileSync(abs));
	}
	return out;
}

const args = parseArgs(process.argv.slice(2));
const dir = resolve(args.dir);
const manifestPath = args.manifest ? resolve(args.manifest) : join(dir, 'fplugin.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
delete manifest.entrypointUrl;
if (manifest.schemaVersion !== 2) throw new Error('The manifest must declare "schemaVersion": 2');
if (!manifest.repository) throw new Error('The manifest needs "repository": listed plugins must have public source');

const files = collectFiles(dir);
if (!files['plugin.py']) throw new Error(`No plugin.py in ${dir}`);
files['fplugin.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, '\t') + '\n');
const sorted = Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]]));
const zip = zipSync(sorted, { level: 9, mtime: FIXED_MTIME });
if (zip.byteLength > MAX_ZIP_BYTES) throw new Error(`Zip is ${zip.byteLength} bytes, over the limit`);
const sha256 = createHash('sha256').update(zip).digest('hex');

const name = `${manifest.id}-${manifest.version}.zip`;
const relPath = `plugins/${manifest.id}/${manifest.version}/${name}`;
const outPath = join(root, relPath);
if (existsSync(outPath)) {
	const existing = createHash('sha256').update(readFileSync(outPath)).digest('hex');
	if (existing !== sha256)
		throw new Error(`${relPath} exists with different contents; hosted versions are never replaced`);
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, zip);

const entry = {};
for (const field of ENTRY_MANIFEST_FIELDS) if (manifest[field] !== undefined) entry[field] = manifest[field];
if (manifest.icon) entry.iconSvg = new TextDecoder().decode(files[manifest.icon]);
entry.zip = { url: new URL(relPath, args.base).href, sha256 };
entry.listed = new Date().toISOString().slice(0, 10);

console.error(`wrote ${relPath} (${zip.byteLength} bytes, sha256 ${sha256})`);
console.log(JSON.stringify(entry, null, '\t'));
