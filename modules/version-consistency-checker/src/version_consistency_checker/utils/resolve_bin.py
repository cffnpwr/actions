import os
import shutil
from pathlib import Path


def resolve_binary_path(cmd_name: str) -> Path | None:
  path_env = os.getenv("PATH")
  if path_env is None:
    return None

  cmd_path = shutil.which(cmd_name, path=path_env)
  if cmd_path is None:
    return None

  return Path(cmd_path)
