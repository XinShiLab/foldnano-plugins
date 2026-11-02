/** Where GitHub Pages serves this repo; hosted zip URLs start with it. */
export const DEFAULT_PAGES_BASE = 'https://xinshilab.github.io/foldnano-plugins/';

/** Entry fields copied from the plugin's fplugin.json, which check.mjs keeps equal. */
export const ENTRY_MANIFEST_FIELDS = [
	'id',
	'version',
	'name',
	'description',
	'tags',
	'authors',
	'maintainers',
	'license',
	'repository',
	'upstream',
];

/** Foldnano's MAX_PLUGIN_ZIP_BYTES. */
export const MAX_ZIP_BYTES = 50 * 1024 * 1024;
