import sys
from pathlib import Path

import typer

from version_consistency_checker.checker import check_consistency
from version_consistency_checker.providers.mise import MiseProvider
from version_consistency_checker.providers.nix import NixProvider

app = typer.Typer(add_completion=False)


@app.command()
def main(
  flake_dir: Path = typer.Option(
    Path(),
    "--flake-dir",
    help="Path to the directory containing flake.nix",
    exists=True,
    file_okay=False,
    resolve_path=True,
  ),
  project_dir: Path = typer.Option(
    Path(),
    "--project-dir",
    help="Path to the project directory containing mise.toml",
    exists=True,
    file_okay=False,
    resolve_path=True,
  ),
) -> None:
  nix = NixProvider(flake_dir=flake_dir)
  mise = MiseProvider(project_dir=project_dir)

  nix_versions = nix.fetch_tool_versions()
  mise_versions = mise.fetch_tool_versions()

  mismatches = check_consistency(nix_versions, mise=mise_versions)

  if not mismatches:
    typer.echo("All tool versions are consistent.")
    return

  for mismatch in mismatches:
    for source, version in mismatch.mismatched_sources.items():
      typer.echo(
        f"Version mismatch for '{mismatch.tool}': "
        f"nix={mismatch.nix_version}, {source}={version}",
        err=True,
      )

  sys.exit(1)
