"""
Community Demo
==============
A minimal community plugin: Foldnano downloaded it from the foldnano-plugins listing and checked
its SHA-256 before installing it. Read-only; it reports on the open design and never changes it.
"""

from foldnano import PluginContext, parse_foldnano_json


def run(ctx: PluginContext) -> None:
    ctx.log("Community Demo 1.0.1, installed from the Foldnano community listing.")
    try:
        part = parse_foldnano_json(ctx.get_part_as_foldnano_json())
    except RuntimeError as exc:
        ctx.log(f"No design to report on: {exc}")
        return
    staples = [o for o in part.oligos if not o.is_scaffold]
    ctx.log(f"The open design has {len(part.oligos)} oligos, {len(staples)} of them staples.")
