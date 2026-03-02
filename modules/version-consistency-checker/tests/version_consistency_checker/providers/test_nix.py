import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from version_consistency_checker.providers.nix import NixProvider


def _make_completed_process(stdout: str = "", returncode: int = 0) -> MagicMock:
  mock = MagicMock(spec=subprocess.CompletedProcess)
  mock.stdout = stdout
  mock.returncode = returncode
  mock.stderr = ""
  return mock


def test_init_with_explicit_bin_path(tmp_path: Path) -> None:
  bin_path = Path("/usr/bin/nix")
  provider = NixProvider(flake_dir=tmp_path, bin_path=bin_path)
  assert provider.bin_path == bin_path
  assert provider.flake_dir == tmp_path


def test_init_resolves_bin_from_path(tmp_path: Path) -> None:
  with patch(
    "version_consistency_checker.providers.nix.resolve_bin.resolve_binary_path",
    return_value=Path("/usr/bin/nix"),
  ):
    provider = NixProvider(flake_dir=tmp_path)
  assert provider.bin_path == Path("/usr/bin/nix")


def test_init_raises_when_nix_not_found(tmp_path: Path) -> None:
  with (
    patch(
      "version_consistency_checker.providers.nix.resolve_bin.resolve_binary_path",
      return_value=None,
    ),
    pytest.raises(RuntimeError, match="nix is not found in PATH"),
  ):
    NixProvider(flake_dir=tmp_path)


def test_get_current_system_success(tmp_path: Path) -> None:
  provider = NixProvider(flake_dir=tmp_path, bin_path=Path("/usr/bin/nix"))
  mock_result = _make_completed_process(stdout="x86_64-linux\n")

  with patch("subprocess.run", return_value=mock_result):
    system = provider._get_current_system()

  assert system == "x86_64-linux"


def test_get_current_system_failure(tmp_path: Path) -> None:
  provider = NixProvider(flake_dir=tmp_path, bin_path=Path("/usr/bin/nix"))
  mock_result = _make_completed_process(returncode=1)
  mock_result.stderr = "error: something went wrong"

  with (
    patch("subprocess.run", return_value=mock_result),
    pytest.raises(RuntimeError, match="failed to get current system"),
  ):
    provider._get_current_system()


def test_fetch_tool_versions_success(tmp_path: Path) -> None:
  provider = NixProvider(flake_dir=tmp_path, bin_path=Path("/usr/bin/nix"))
  system_result = _make_completed_process(stdout="x86_64-linux")
  packages_json = '[{"name": "nodejs", "version": "20.0.0"}, {"name": "python3", "version": "3.11.0"}]'  # noqa: E501
  packages_result = _make_completed_process(stdout=packages_json)

  with patch("subprocess.run", side_effect=[system_result, packages_result]):
    versions = provider.fetch_tool_versions()

  assert versions == {"nodejs": "20.0.0", "python3": "3.11.0"}


def test_fetch_tool_versions_failure(tmp_path: Path) -> None:
  provider = NixProvider(flake_dir=tmp_path, bin_path=Path("/usr/bin/nix"))
  system_result = _make_completed_process(stdout="x86_64-linux")
  failed_result = _make_completed_process(returncode=1)
  failed_result.stderr = "error: nix eval failed"

  with (
    patch("subprocess.run", side_effect=[system_result, failed_result]),
    pytest.raises(RuntimeError, match="failed to run nix eval"),
  ):
    provider.fetch_tool_versions()


def test_fetch_tool_versions_skips_empty_version(tmp_path: Path) -> None:
  provider = NixProvider(flake_dir=tmp_path, bin_path=Path("/usr/bin/nix"))
  system_result = _make_completed_process(stdout="x86_64-linux")
  packages_json = '[{"name": "nodejs", "version": "20.0.0"}, {"name": "no-version-pkg", "version": ""}]'  # noqa: E501
  packages_result = _make_completed_process(stdout=packages_json)

  with patch("subprocess.run", side_effect=[system_result, packages_result]):
    versions = provider.fetch_tool_versions()

  assert "no-version-pkg" not in versions
  assert versions == {"nodejs": "20.0.0"}
