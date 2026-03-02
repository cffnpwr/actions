from pydantic import BaseModel

from version_consistency_checker.utils.normalize_tool_name import normalize_tool_name


class Mismatch(BaseModel):
  tool: str
  nix_version: str
  mismatched_sources: dict[str, str]  # source name -> version


def check_consistency(
  nix_versions: dict[str, str],
  **sources: dict[str, str],
) -> list[Mismatch]:
  mismatches: list[Mismatch] = []

  for tool, nix_version in nix_versions.items():
    mismatched: dict[str, str] = {}

    for source_name, raw_versions in sources.items():
      normalized = {normalize_tool_name(k): v for k, v in raw_versions.items()}
      source_version = normalized.get(tool)

      if source_version is None:
        continue

      if source_version != nix_version:
        mismatched[source_name] = source_version

    if mismatched:
      mismatches.append(
        Mismatch(tool=tool, nix_version=nix_version, mismatched_sources=mismatched)
      )

  return mismatches
