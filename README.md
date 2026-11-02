# Foldnano community plugins

The list of community plugins that [Foldnano](https://github.com/XinShiLab/foldnano) shows in its
plugin Hub, and hosted copies of plugin zips where their licenses allow it.

Community plugins don't ship with Foldnano. Each one has its own public source repository and its
own license. Foldnano downloads a listed plugin's zip when you click **Install**, checks it against
the SHA-256 recorded here, and then shows the usual review before anything is installed.

You can always install any plugin zip yourself with **Import zip**; being listed here only adds it
to the Hub.

## What's here

| Path                               | What it is                                                       |
| ---------------------------------- | ---------------------------------------------------------------- |
| `registry.json`                    | The listing, one entry per plugin                                |
| `schema/registry-v1.schema.json`   | Format of `registry.json`                                        |
| `schema/fplugin-v2.schema.json`    | Copy of Foldnano's plugin manifest schema, used by the checks    |
| `plugins/<id>/`                    | Hosted copies (only with the author's agreement), with `LICENSE` and `NOTICE` |
| `scripts/pack.mjs`                 | Builds a plugin zip reproducibly and prints its listing entry    |
| `scripts/check.mjs`                | Checks every entry against its zip (run in CI and weekly)        |

## Licenses

The listing, schemas and scripts are MIT (see `LICENSE`). **Plugins are not:** every folder under
`plugins/` keeps the license of the plugin it holds. Hosted copies are unmodified releases, served
with their license and a link to their source.

## Listing a plugin

Not open to outside submissions yet. See [CONTRIBUTING.md](CONTRIBUTING.md) for how maintainers
add or update an entry.
