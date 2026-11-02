// Checks every registry.json entry against the hosted zip it points to.
//
//   node scripts/check.mjs [--live] [--base <git-ref>]
//
// Per entry: the listing matches its schema; zip.url is this repo's Pages path for the entry's id
// and version, and the file is in this checkout (so a PR can check a zip Pages doesn't serve yet);
// it matches zip.sha256 and holds a valid fplugin.json at schemaVersion 2 whose display and credit
// fields equal the entry's, and an icon equal to iconSvg.
// --live also downloads zip.url from Pages and checks it serves the same bytes with
// Access-Control-Allow-Origin, which Foldnano needs to fetch it from the browser.
// --base also fails if any commit since <git-ref> changed or deleted a file in a published version
// folder (plugins/<id>/<version>/): released Foldnano builds pin each version's sha256, so only
// new folders may be added.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { unzipSync } from 'fflate';
import { DEFAULT_PAGES_BASE, ENTRY_MANIFEST_FIELDS, MAX_ZIP_BYTES } from './shared.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pagesBase = process.env.PAGES_BASE ?? DEFAULT_PAGES_BASE;
const live = process.argv.includes('--live');
const baseIndex = process.argv.indexOf('--base');
const base = baseIndex === -1 ? null : process.argv[baseIndex + 1];
const ORIGIN = 'https://foldnano.example';

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateRegistry = ajv.compile(readJson('schema/registry-v1.schema.json'));
const validateManifest = ajv.compile(readJson('schema/fplugin-v2.schema.json'));

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const sha256Of = (bytes) => createHash('sha256').update(bytes).digest('hex');

function hostedPath(entry) {
	return `plugins/${entry.id}/${entry.version}/${entry.id}-${entry.version}.zip`;
}

async function checkLive(entry) {
	const res = await fetch(entry.zip.url, { headers: { Origin: ORIGIN } });
	if (!res.ok) return fail(entry.id, `live: HTTP ${res.status} from ${entry.zip.url}`);
	const acao = res.headers.get('access-control-allow-origin');
	if (acao !== '*' && acao !== ORIGIN)
		fail(entry.id, 'live: Pages did not send Access-Control-Allow-Origin');
	const bytes = new Uint8Array(await res.arrayBuffer());
	if (bytes.byteLength > MAX_ZIP_BYTES) return fail(entry.id, 'live: zip is over the size limit');
	if (sha256Of(bytes) !== entry.zip.sha256)
		fail(entry.id, 'live: Pages serves different bytes than the listing pins');
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

function checkPublishedUnchanged() {
	let diff;
	try {
		diff = execFileSync(
			'git',
			['diff', '--name-status', '--no-renames', `${base}...HEAD`, '--', 'plugins/'],
			{ cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
		);
	} catch (e) {
		return fail('--base', `cannot compare with ${base} (${e.stderr?.toString().trim() || e.message})`);
	}
	for (const line of diff.split('\n').filter(Boolean)) {
		const [status, path] = line.split('\t');
		if (status !== 'A' && /^plugins\/[^/]+\/[^/]+\//.test(path))
			fail(path, `${status === 'D' ? 'deleted' : 'changed'} in a published version; add a new version instead`);
	}
}

async function checkEntry(entry) {
	const rel = hostedPath(entry);
	if (entry.zip.url !== new URL(rel, pagesBase).href)
		return fail(entry.id, `zip.url must be ${new URL(rel, pagesBase).href}`);
	const local = join(root, rel);
	if (!existsSync(local)) return fail(entry.id, `hosted zip missing from this repo: ${rel}`);
	const bytes = new Uint8Array(readFileSync(local));
	if (bytes.byteLength > MAX_ZIP_BYTES) return fail(entry.id, 'zip is over the size limit');
	const sha256 = sha256Of(bytes);
	if (sha256 !== entry.zip.sha256)
		return fail(entry.id, `sha256 is ${sha256}, listing says ${entry.zip.sha256}`);
	let files;
	try {
		files = unzipSync(bytes);
	} catch (e) {
		return fail(entry.id, `not a valid zip (${e.message})`);
	}
	checkManifest(entry, files);
	if (live) {
		try {
			await checkLive(entry);
		} catch (e) {
			fail(entry.id, `live: download failed (${e.message})`);
		}
	}
}

const registry = readJson('registry.json');
if (!validateRegistry(registry)) {
	console.error(`error    registry.json fails its schema: ${ajv.errorsText(validateRegistry.errors)}`);
	process.exit(1);
}
if (base) checkPublishedUnchanged();
const seen = new Set();
for (const entry of registry.plugins) {
	if (seen.has(entry.id)) fail(entry.id, 'listed twice');
	seen.add(entry.id);
	await checkEntry(entry);
}

for (const e of errors) console.error(`error    ${e}`);
console.log(
	`${registry.plugins.length} entr${registry.plugins.length === 1 ? 'y' : 'ies'}: ` +
		`${errors.length} error(s)`
);
process.exit(errors.length > 0 ? 1 : 0);
