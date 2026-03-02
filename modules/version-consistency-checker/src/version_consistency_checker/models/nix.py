from pydantic import BaseModel, ConfigDict, RootModel


class NixPackage(BaseModel):
  model_config = ConfigDict(strict=True)

  name: str
  version: str


class NixPackages(RootModel[list[NixPackage]]):
  model_config = ConfigDict(strict=True)
