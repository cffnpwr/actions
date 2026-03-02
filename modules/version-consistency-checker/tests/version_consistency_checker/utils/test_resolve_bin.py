from pathlib import Path
from unittest.mock import patch

from version_consistency_checker.utils.resolve_bin import resolve_binary_path


def test_resolve_binary_path_found() -> None:
  with patch("shutil.which", return_value="/usr/bin/node"):
    result = resolve_binary_path("node")
  assert result == Path("/usr/bin/node")


def test_resolve_binary_path_not_found() -> None:
  with patch("shutil.which", return_value=None):
    result = resolve_binary_path("nonexistent-tool")
  assert result is None


def test_resolve_binary_path_no_path_env() -> None:
  with patch.dict("os.environ", {}, clear=True):
    result = resolve_binary_path("node")
  assert result is None
