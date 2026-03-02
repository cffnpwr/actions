import pytest

from version_consistency_checker.utils.normalize_tool_name import normalize_tool_name


@pytest.mark.parametrize(
  ("key", "expected"),
  [
    ("node", "node"),
    ("aqua:cli/node", "node"),
    ("npm:node", "node"),
    ("go:golang.org/x/tools/cmd/gopls", "gopls"),
    ("core:node", "node"),
    ("", ""),
    ("a/b/c", "c"),
  ],
)
def test_normalize_tool_name(key: str, expected: str) -> None:
  assert normalize_tool_name(key) == expected
