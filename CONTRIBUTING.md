# Adding or updating a plugin

For now, entries are added by Foldnano maintainers. The usual case: a maintainer asks the original
author for permission, forks their project (keeping its license), adapts it into a Foldnano plugin
and lists it here.

## Requirements

- A **public source repository** for the plugin (`repository`).
- A manifest at `"schemaVersion": 2` with credit fields: `authors`, `maintainers` (if not the
  authors), `license`, `repository`, and `upstream` for forks.
- A zip that installs in Foldnano.
- To host a copy here: a license that allows redistribution **and** the author's agreement.
  Otherwise link to the author's own download.

## Steps

1. Build the zip reproducibly and get the entry:

   ```sh
   npm ci
   npm run pack -- <plugin-folder> [--manifest <fplugin.json>] [--host]
   ```

   `--host` writes the zip to `plugins/<id>/<version>/` and points the entry's URL at it.
   Without it, set `zip.url` to the author's download yourself.

2. Paste the printed entry into `registry.json` and set `listed` to today's date.
3. For a hosted copy, add `plugins/<id>/LICENSE` and a `NOTICE` (upstream and fork links).
4. `npm run check`, then open a PR. CI runs the same check.

## How the zip is fetched

`zip.fetch` says how Foldnano gets the file:

- `direct`: Foldnano downloads `zip.url` itself. The host must send
  `Access-Control-Allow-Origin` (GitHub Pages, `raw.githubusercontent.com` and jsDelivr do;
  **GitHub release downloads don't**).
- `manual`: Foldnano shows a download link; the user downloads the zip and drops it in.

`npm run check` tests the header and fails when `fetch` doesn't match.

## Updating

A new version is a new entry state, never a changed file: new `version`, new `zip.url` (hosted
copies go under a new `plugins/<id>/<version>/` folder) and new `sha256`. Hosted versions already
listed are never replaced.

## Getting the listing into Foldnano

Foldnano keeps its own copy of `registry.json`, taken at a pinned commit of this repo by a script
in the Foldnano repository. A change here reaches users with the next Foldnano release.
