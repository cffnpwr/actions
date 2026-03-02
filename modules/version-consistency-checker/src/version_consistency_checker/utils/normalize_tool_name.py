def normalize_tool_name(key: str) -> str:
  """Normalize a mise tool key to a short tool name.

  Rules:
  - If the key contains ':', take the part after ':' as the package name.
  - If the package name contains '/', take the part after the last '/'.
  """
  package = key.split(":", 1)[-1]
  return package.rsplit("/", 1)[-1]
