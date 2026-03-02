import json
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from version_consistency_checker.providers.mise import MiseProvider

_TOOL_SOURCE = {
  "type": "toml",
  "path": "/home/user/.config/mise/config.toml",
}

_ACTIVE_TOOL = {
  "version": "20.0.0",
  "requested_version": "20",
  "install_path": "/home/user/.local/share/mise/installs/node/20.0.0",
  "source": _TOOL_SOURCE,
  "installed": True,
  "active": True,
}

_INACTIVE_TOOL = {
  **_ACTIVE_TOOL,
  "version": "18.0.0",
  "active": False,
}


def _make_completed_process(stdout: str = "", returncode: int = 0) -> MagicMock:
  mock = MagicMock(spec=subprocess.CompletedProcess)
  mock.stdout = stdout
  mock.returncode = returncode
  mock.stderr = ""
  return mock


def test_init_with_explicit_bin_path(tmp_path: Path) -> None:
  bin_path = Path("/usr/bin/mise")
  provider = MiseProvider(project_dir=tmp_path, bin_path=bin_path)
  assert provider.bin_path == bin_path
  assert provider.project_dir == tmp_path


def test_init_resolves_bin_from_path(tmp_path: Path) -> None:
  with patch(
    "version_consistency_checker.providers.mise.resolve_bin.resolve_binary_path",
    return_value=Path("/usr/bin/mise"),
  ):
    provider = MiseProvider(project_dir=tmp_path)
  assert provider.bin_path == Path("/usr/bin/mise")


def test_init_raises_when_mise_not_found(tmp_path: Path) -> None:
  with (
    patch(
      "version_consistency_checker.providers.mise.resolve_bin.resolve_binary_path",
      return_value=None,
    ),
    pytest.raises(RuntimeError, match="mise is not found in PATH"),
  ):
    MiseProvider(project_dir=tmp_path)


def test_fetch_tool_versions_success(tmp_path: Path) -> None:
  provider = MiseProvider(project_dir=tmp_path, bin_path=Path("/usr/bin/mise"))
  mise_json = json.dumps({"node": [_ACTIVE_TOOL]})
  mock_result = _make_completed_process(stdout=mise_json)

  with patch("subprocess.run", return_value=mock_result):
    versions = provider.fetch_tool_versions()

  assert versions == {"node": "20.0.0"}


def test_fetch_tool_versions_failure(tmp_path: Path) -> None:
  provider = MiseProvider(project_dir=tmp_path, bin_path=Path("/usr/bin/mise"))
  mock_result = _make_completed_process(returncode=1)
  mock_result.stderr = "error: mise failed"

  with (
    patch("subprocess.run", return_value=mock_result),
    pytest.raises(RuntimeError, match="failed to run mise"),
  ):
    provider.fetch_tool_versions()


def test_fetch_tool_versions_skips_inactive(tmp_path: Path) -> None:
  provider = MiseProvider(project_dir=tmp_path, bin_path=Path("/usr/bin/mise"))
  mise_json = json.dumps({"node": [_INACTIVE_TOOL]})
  mock_result = _make_completed_process(stdout=mise_json)

  with patch("subprocess.run", return_value=mock_result):
    versions = provider.fetch_tool_versions()

  assert "node" not in versions


def test_fetch_tool_versions_takes_first_active(tmp_path: Path) -> None:
  provider = MiseProvider(project_dir=tmp_path, bin_path=Path("/usr/bin/mise"))
  second_active = {**_ACTIVE_TOOL, "version": "22.0.0"}
  mise_json = json.dumps({"node": [_ACTIVE_TOOL, second_active]})
  mock_result = _make_completed_process(stdout=mise_json)

  with patch("subprocess.run", return_value=mock_result):
    versions = provider.fetch_tool_versions()

  assert versions == {"node": "20.0.0"}


def test_fetch_tool_versions_multiple_tools(tmp_path: Path) -> None:
  provider = MiseProvider(project_dir=tmp_path, bin_path=Path("/usr/bin/mise"))
  python_tool = {
    **_ACTIVE_TOOL,
    "version": "3.11.0",
    "requested_version": "3.11",
  }
  mise_json = json.dumps({"node": [_ACTIVE_TOOL], "python": [python_tool]})
  mock_result = _make_completed_process(stdout=mise_json)

  with patch("subprocess.run", return_value=mock_result):
    versions = provider.fetch_tool_versions()

  assert versions == {"node": "20.0.0", "python": "3.11.0"}
