from version_consistency_checker.checker import Mismatch, check_consistency


def test_no_mismatch_exact_match() -> None:
  result = check_consistency({"node": "20.0.0"}, mise={"node": "20.0.0"})
  assert result == []


def test_mismatch_version_differs() -> None:
  result = check_consistency({"node": "20.0.0"}, mise={"node": "18.0.0"})
  assert len(result) == 1
  assert result[0].tool == "node"
  assert result[0].nix_version == "20.0.0"
  assert result[0].mismatched_sources == {"mise": "18.0.0"}


def test_tool_not_in_source_is_skipped() -> None:
  result = check_consistency({"node": "20.0.0"}, mise={"python": "3.11.0"})
  assert result == []


def test_empty_source() -> None:
  result = check_consistency({"node": "20.0.0"}, mise={})
  assert result == []


def test_empty_nix_versions() -> None:
  result = check_consistency({}, mise={"node": "20.0.0"})
  assert result == []


def test_no_sources() -> None:
  result = check_consistency({"node": "20.0.0"})
  assert result == []


def test_normalized_name_match() -> None:
  result = check_consistency({"node": "20.0.0"}, mise={"aqua:cli/node": "20.0.0"})
  assert result == []


def test_normalized_name_mismatch() -> None:
  result = check_consistency({"node": "20.0.0"}, mise={"aqua:cli/node": "18.0.0"})
  assert len(result) == 1
  assert result[0].tool == "node"
  assert result[0].mismatched_sources == {"mise": "18.0.0"}


def test_multiple_sources_multiple_mismatches() -> None:
  result = check_consistency(
    {"node": "20.0.0"},
    mise={"node": "18.0.0"},
    other={"node": "19.0.0"},
  )
  assert len(result) == 1
  assert result[0].mismatched_sources == {"mise": "18.0.0", "other": "19.0.0"}


def test_multiple_tools_partial_mismatch() -> None:
  result = check_consistency(
    {"node": "20.0.0", "python": "3.11.0"},
    mise={"node": "18.0.0", "python": "3.11.0"},
  )
  assert len(result) == 1
  assert result[0].tool == "node"


def test_mismatch_model_fields() -> None:
  result = check_consistency({"node": "20.0.0"}, mise={"node": "18.0.0"})
  mismatch = result[0]
  assert isinstance(mismatch, Mismatch)
  assert mismatch.tool == "node"
  assert mismatch.nix_version == "20.0.0"
  assert "mise" in mismatch.mismatched_sources
