from pathlib import Path

import pytest
from pydantic import ValidationError

from version_consistency_checker.models.mise import MiseTool, MiseTools, ToolSource

_TOOL_SOURCE = {
  "type": "toml",
  "path": Path("/home/user/.config/mise/config.toml"),
}

_MISE_TOOL_BASE = {
  "version": "20.0.0",
  "requested_version": "20",
  "install_path": Path("/home/user/.local/share/mise/installs/node/20.0.0"),
  "source": _TOOL_SOURCE,
  "installed": True,
  "active": True,
}


def test_tool_source_valid() -> None:
  source = ToolSource.model_validate(_TOOL_SOURCE)
  assert source.type == "toml"


def test_mise_tool_valid() -> None:
  tool = MiseTool.model_validate(_MISE_TOOL_BASE)
  assert tool.version == "20.0.0"
  assert tool.active is True


def test_mise_tool_source_none() -> None:
  data = {**_MISE_TOOL_BASE, "source": None}
  tool = MiseTool.model_validate(data)
  assert tool.source is None


def test_mise_tool_requested_version_none() -> None:
  data = {**_MISE_TOOL_BASE, "requested_version": None}
  tool = MiseTool.model_validate(data)
  assert tool.requested_version is None


def test_mise_tool_missing_version() -> None:
  data = {k: v for k, v in _MISE_TOOL_BASE.items() if k != "version"}
  with pytest.raises(ValidationError):
    MiseTool.model_validate(data)


def test_mise_tools_valid() -> None:
  data = {
    "node": [_MISE_TOOL_BASE],
    "python": [
      {
        **_MISE_TOOL_BASE,
        "version": "3.11.0",
        "requested_version": "3.11",
      }
    ],
  }
  tools = MiseTools.model_validate(data)
  assert "node" in tools.root
  assert "python" in tools.root


def test_mise_tools_iter() -> None:
  data = {
    "node": [_MISE_TOOL_BASE],
    "python": [
      {
        **_MISE_TOOL_BASE,
        "version": "3.11.0",
        "requested_version": "3.11",
      }
    ],
  }
  tools = MiseTools.model_validate(data)
  names = [name for name, _ in tools]
  assert set(names) == {"node", "python"}


def test_mise_tools_model_validate_json() -> None:
  raw = (
    '{"node": [{"version": "20.0.0", "requested_version": "20",'
    ' "install_path": "/home/user/.local/share/mise/installs/node/20.0.0",'
    ' "source": {"type": "toml", "path": "/home/user/.config/mise/config.toml"},'
    ' "installed": true, "active": true}]}'
  )
  tools = MiseTools.model_validate_json(raw)
  assert tools.root["node"][0].version == "20.0.0"
