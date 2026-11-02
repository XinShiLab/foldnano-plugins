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
4. `npm run check -- --base origin/main`, then open a PR. CI runs the same check.

## How the zip is fetched

Foldnano downloads `zip.url` straight from GitHub Pages, which sends
`Access-Control-Allow-Origin: *` so the browser may read it. (GitHub release downloads don't send
that header, which is why zips are hosted here rather than linked.) `npm run check` reads each zip
from this checkout. After every Pages build, and weekly, CI runs `npm run check -- --live` to
confirm Pages serves the same bytes with that header.

## Demo plugins

`demos/<id>/` holds the source of small plugins maintained here and tagged `Demo`, so Foldnano
users can hide them. Pack them like any other plugin: `npm run pack -- demos/<id>`.

## Updating

A new version is a new entry state, never a changed file: new `version`, new `zip.url` (a new
`plugins/<id>/<version>/` folder) and new `sha256`.

**Published versions are immutable.** Once a `plugins/<id>/<version>/` folder is on `main`, its
files are never changed, renamed or deleted, even after a newer version replaces it in
`registry.json`. Each Foldnano release carries the listing it was built with and pins that
version's `sha256`, so an older Foldnano still downloads the old zip; a changed file would fail
its hash check and a deleted one would fail to download. To fix a broken release, publish a new
version.

CI enforces this: `npm run check -- --base <ref>` fails if any commit since `<ref>` changed or
deleted a file inside a version folder. Pull requests compare with their base branch and pushes
to `main` with the previous commit. Run it locally before opening a PR:

```sh
npm run check -- --base origin/main
```

A plugin's `LICENSE` and `NOTICE` sit outside its version folders and may be updated; each zip
carries its own copy.

## Getting the listing into Foldnano

Foldnano keeps its own copy of `registry.json`, taken at a pinned commit of this repo by a script
in the Foldnano repository. A change here reaches users with the next Foldnano release.
