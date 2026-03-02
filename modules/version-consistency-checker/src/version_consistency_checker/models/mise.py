from collections.abc import Generator
from pathlib import Path

from pydantic import BaseModel, ConfigDict, RootModel


class ToolSource(BaseModel):
  model_config = ConfigDict(strict=True)

  type: str
  path: Path


class MiseTool(BaseModel):
  model_config = ConfigDict(strict=True)

  version: str
  requested_version: str | None = None
  install_path: Path
  source: ToolSource | None = None
  installed: bool
  active: bool


class MiseTools(RootModel[dict[str, list[MiseTool]]]):
  model_config = ConfigDict(strict=True)

  def __iter__(self) -> Generator[tuple[str, list[MiseTool]]]:
    yield from self.root.items()
