import subprocess
from pathlib import Path

from version_consistency_checker.models.nix import NixPackages
from version_consistency_checker.providers.base import BaseProvider
from version_consistency_checker.utils import resolve_bin

_NIX_EVAL_APPLY = (
  'pkgs: map (p: { name = p.pname or p.name; version = p.version or ""; }) pkgs'
)


class NixProvider(BaseProvider):
  bin_path: Path
  flake_dir: Path

  def __init__(self, flake_dir: Path, bin_path: Path | None = None) -> None:
    self.flake_dir = flake_dir

    if bin_path is not None:
      self.bin_path = bin_path
    else:
      nix_path = resolve_bin.resolve_binary_path("nix")
      if nix_path is None:
        err_msg = "nix is not found in PATH"
        raise RuntimeError(err_msg)

      self.bin_path = nix_path

  def _get_current_system(self) -> str:
    result = subprocess.run(
      [self.bin_path, "eval", "--raw", "--impure", "--expr", "builtins.currentSystem"],
      capture_output=True,
      text=True,
    )

    if result.returncode != 0:
      err_msg = f"failed to get current system: {result.stderr}"
      raise RuntimeError(err_msg)

    return result.stdout.strip()

  def fetch_tool_versions(self) -> dict[str, str]:
    system = self._get_current_system()
    attr = f".#devShells.{system}.default.nativeBuildInputs"

    result = subprocess.run(
      [
        self.bin_path,
        "eval",
        "--json",
        attr,
        "--apply",
        _NIX_EVAL_APPLY,
      ],
      capture_output=True,
      text=True,
      cwd=self.flake_dir,
    )

    if result.returncode != 0:
      err_msg = f"failed to run nix eval: {result.stderr}"
      raise RuntimeError(err_msg)

    fetched: dict[str, str] = {}
    nix_packages = NixPackages.model_validate_json(result.stdout)
    for pkg in nix_packages.root:
      if pkg.version:
        fetched[pkg.name] = pkg.version

    return fetched
