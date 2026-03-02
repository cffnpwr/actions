from abc import ABCMeta, abstractmethod


class BaseProvider(metaclass=ABCMeta):

  @abstractmethod
  def fetch_tool_versions(self) -> dict[str, str]:
    pass
