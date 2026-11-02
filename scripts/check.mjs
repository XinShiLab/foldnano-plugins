// Checks every registry.json entry against the zip it points to.
//
//   node scripts/check.mjs [--skip-remote]
//
// Per entry: the listing matches its schema; the zip downloads (hosted copies are read from this
// checkout, so a PR can check a zip Pages doesn't serve yet), matches zip.sha256, holds a valid
// fplugin.json at schemaVersion 2 whose display and credit fields equal the entry's, and an icon
// equal to iconSvg; and zip.fetch matches whether the browser may fetch zip.url directly.
// Nothing downloaded is kept.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { unzipSync } from 'fflate';
import { DEFAULT_PAGES_BASE, ENTRY_MANIFEST_FIELDS, MAX_ZIP_BYTES } from './shared.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pagesBase = process.env.PAGES_BASE ?? DEFAULT_PAGES_BASE;
const skipRemote = process.argv.includes('--skip-remote');
const ORIGIN = 'https://foldnano.example';

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateRegistry = ajv.compile(readJson('schema/registry-v1.schema.json'));
const validateManifest = ajv.compile(readJson('schema/fplugin-v2.schema.json'));

const errors = [];
const warnings = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

/** Follows redirects by hand so every hop's Access-Control-Allow-Origin can be checked. */
async function fetchRemote(url) {
	let current = url;
	let corsOnEveryHop = true;
	for (let hop = 0; hop < 10; hop++) {
		const res = await fetch(current, { redirect: 'manual', headers: { Origin: ORIGIN } });
		const acao = res.headers.get('access-control-allow-origin');
		if (acao !== '*' && acao !== ORIGIN) corsOnEveryHop = false;
		if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
			current = new URL(res.headers.get('location'), current).href;
			continue;
		}
		if (!res.ok) throw new Error(`HTTP ${res.status} from ${current}`);
		const length = Number(res.headers.get('content-length') ?? 0);
		if (length > MAX_ZIP_BYTES) throw new Error(`zip is ${length} bytes, over the limit`);
		const bytes = new Uint8Array(await res.arrayBuffer());
		if (bytes.byteLength > MAX_ZIP_BYTES) throw new Error('zip is over the size limit');
		return { bytes, corsOnEveryHop };
	}
	throw new Error('too many redirects');
}

async function getZip(entry) {
	if (entry.zip.url.startsWith(pagesBase)) {
		const local = join(root, decodeURI(entry.zip.url.slice(pagesBase.length)));
		if (!existsSync(local)) throw new Error(`hosted zip missing from this repo: ${local}`);
		// GitHub Pages sends Access-Control-Allow-Origin: * for every file.
		return { bytes: new Uint8Array(readFileSync(local)), corsOnEveryHop: true, hosted: true };
	}
	if (skipRemote) return null;
	return { ...(await fetchRemote(entry.zip.url)), hosted: false };
}

function checkManifest(entry, files) {
	const raw = files['fplugin.json'];
	if (!raw) return fail(entry.id, 'zip has no fplugin.json');
	let manifest;
	try {
		manifest = JSON.parse(new TextDecoder().decode(raw));
	} catch (e) {
		return fail(entry.id, `fplugin.json is not valid JSON (${e.message})`);
	}
	if (!validateManifest(manifest))
		fail(entry.id, `fplugin.json fails the manifest schema: ${ajv.errorsText(validateManifest.errors)}`);
	if (manifest.entrypointUrl !== undefined)
		fail(entry.id, 'fplugin.json sets entrypointUrl; a listed zip must not point elsewhere');
	if (!files['plugin.py']) fail(entry.id, 'zip has no plugin.py');
	for (const field of ENTRY_MANIFEST_FIELDS) {
		if (JSON.stringify(entry[field]) !== JSON.stringify(manifest[field]))
			fail(entry.id, `"${field}" differs from fplugin.json (${JSON.stringify(manifest[field])})`);
	}
	if (manifest.icon) {
		const icon = files[manifest.icon];
		if (!icon) fail(entry.id, `icon ${manifest.icon} is missing from the zip`);
		else if (entry.iconSvg !== new TextDecoder().decode(icon))
			fail(entry.id, `iconSvg differs from ${manifest.icon} in the zip`);
	} else if (entry.iconSvg !== undefined) {
		fail(entry.id, 'iconSvg is set but the manifest has no icon');
	}
}

async function checkEntry(entry) {
	let got;
	try {
		got = await getZip(entry);
	} catch (e) {
		return fail(entry.id, `download failed: ${e.message}`);
	}
	if (!got) return warn(entry.id, 'skipped (remote URL, --skip-remote)');
	if (entry.zip.fetch === 'direct' && !got.corsOnEveryHop)
		fail(entry.id, 'fetch is "direct" but the host does not send Access-Control-Allow-Origin; use "manual"');
	if (entry.zip.fetch === 'manual' && got.corsOnEveryHop)
		warn(entry.id, 'fetch is "manual" but the host allows direct download');
	const sha256 = createHash('sha256').update(got.bytes).digest('hex');
	if (sha256 !== entry.zip.sha256)
		return fail(entry.id, `sha256 is ${sha256}, listing says ${entry.zip.sha256}`);
	let files;
	try {
		files = unzipSync(got.bytes);
	} catch (e) {
		return fail(entry.id, `not a valid zip (${e.message})`);
	}
	checkManifest(entry, files);
}

const registry = readJson('registry.json');
if (!validateRegistry(registry)) {
	console.error(`error    registry.json fails its schema: ${ajv.errorsText(validateRegistry.errors)}`);
	process.exit(1);
}
const seen = new Set();
for (const entry of registry.plugins) {
	if (seen.has(entry.id)) fail(entry.id, 'listed twice');
	seen.add(entry.id);
	await checkEntry(entry);
}

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);
console.log(
	`${registry.plugins.length} entr${registry.plugins.length === 1 ? 'y' : 'ies'}: ` +
		`${errors.length} error(s), ${warnings.length} warning(s)`
);
process.exit(errors.length > 0 ? 1 : 0);
