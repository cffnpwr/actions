import pytest
from pydantic import ValidationError

from version_consistency_checker.models.nix import NixPackage, NixPackages


def test_nix_package_valid() -> None:
  pkg = NixPackage(name="nodejs", version="20.0.0")
  assert pkg.name == "nodejs"
  assert pkg.version == "20.0.0"


def test_nix_package_missing_version() -> None:
  with pytest.raises(ValidationError):
    NixPackage.model_validate({"name": "nodejs"})


def test_nix_package_missing_name() -> None:
  with pytest.raises(ValidationError):
    NixPackage.model_validate({"version": "1.0"})


def test_nix_package_strict_type_name() -> None:
  with pytest.raises(ValidationError):
    NixPackage.model_validate({"name": 123, "version": "1.0"})


def test_nix_package_strict_type_version() -> None:
  with pytest.raises(ValidationError):
    NixPackage.model_validate({"name": "nodejs", "version": 20})


def test_nix_packages_valid() -> None:
  packages = NixPackages.model_validate(
    [
      {"name": "nodejs", "version": "20.0.0"},
      {"name": "python", "version": "3.11.0"},
    ]
  )
  assert len(packages.root) == 2
  assert packages.root[0].name == "nodejs"
  assert packages.root[1].name == "python"


def test_nix_packages_empty() -> None:
  packages = NixPackages.model_validate([])
  assert packages.root == []


def test_nix_packages_model_validate_json() -> None:
  packages = NixPackages.model_validate_json(
    '[{"name": "nodejs", "version": "20.0.0"}]'
  )
  assert packages.root[0].name == "nodejs"
  assert packages.root[0].version == "20.0.0"
