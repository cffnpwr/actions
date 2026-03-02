import subprocess
from pathlib import Path

from version_consistency_checker.models.mise import MiseTools
from version_consistency_checker.providers.base import BaseProvider
from version_consistency_checker.utils import resolve_bin


class MiseProvider(BaseProvider):
  bin_path: Path
  project_dir: Path

  def __init__(self, project_dir: Path, bin_path: Path | None = None) -> None:
    self.project_dir = project_dir

    if bin_path is not None:
      self.bin_path = bin_path
    else:
      mise_path = resolve_bin.resolve_binary_path("mise")
      if mise_path is None:
        err_msg = "mise is not found in PATH"
        raise RuntimeError(err_msg)

      self.bin_path = mise_path

  def fetch_tool_versions(self) -> dict[str, str]:
    args: list[Path | str] = [self.bin_path, "list", "--json"]
    result = subprocess.run(
      args,
      capture_output=True,
      text=True,
      cwd=self.project_dir,
    )

    if result.returncode != 0:
      err_msg = f"failed to run mise: {result.stderr}"
      raise RuntimeError(err_msg)

    fetched: dict[str, str] = {}
    mise_tools = MiseTools.model_validate_json(result.stdout)
    for name, tools in mise_tools:
      for tool in tools:
        if not tool.active:
          continue

        fetched[name] = tool.version
        break

    return fetched
