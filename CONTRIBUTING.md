# Adding or updating a plugin

For now, entries are added by Foldnano maintainers.

## Requirements

- A **public source repository** for the plugin (`repository`).
- A manifest at `"schemaVersion": 2` with credit fields: `authors`, `maintainers` (if not the
  authors), `license`, `repository`, and `upstream` for forks.
- A zip that installs in Foldnano.
- A license that allows sharing copies (MIT, BSD, Apache, MPL, GPL and the like) **and** the
  author's agreement: every listed zip is hosted here. A plugin whose license forbids
  redistribution can't be listed.

## Steps

1. Build the zip reproducibly and get the entry:

   ```sh
   npm ci
   npm run pack -- <plugin-folder> [--manifest <fplugin.json>]
   ```

   It writes the zip to `plugins/<id>/<version>/` and prints the entry, with `zip.url` pointing at
   that file on Pages.

2. Paste the printed entry into `registry.json` and set `listed` to today's date.
3. Add `plugins/<id>/LICENSE` and a `NOTICE` (upstream and fork links) for a new plugin.
4. `npm run check`, then open a PR. CI runs the same check.

## How the zip is fetched

Foldnano downloads `zip.url` straight from GitHub Pages, which sends
`Access-Control-Allow-Origin: *` so the browser may read it. (GitHub release downloads don't send
that header, which is why zips are hosted here rather than linked.) `npm run check` reads each zip
from this checkout; the weekly run adds `--live` to confirm Pages serves the same bytes.

## Demo plugins

`demos/<id>/` holds the source of small plugins maintained here and tagged `Demo`, so Foldnano
users can hide them. Pack them like any other plugin: `npm run pack -- demos/<id>`.

## Updating

A new version is a new entry state, never a changed file: new `version`, new `zip.url` (a new
`plugins/<id>/<version>/` folder) and new `sha256`. Versions already listed are never replaced.

## Getting the listing into Foldnano

Foldnano keeps its own copy of `registry.json`, taken at a pinned commit of this repo by a script
in the Foldnano repository. A change here reaches users with the next Foldnano release.
