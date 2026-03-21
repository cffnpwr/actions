/**
 * Normalize a mise tool key to a short tool name.
 *
 * Rules:
 * - If the key contains ':', take the part after ':' as the package name.
 * - If the package name contains '/', take the part after the last '/'.
 */
export const normalizeToolName = (key: string): string => {
  const colonIndex = key.indexOf(":");
  const package_ = colonIndex !== -1 ? key.slice(colonIndex + 1) : key;
  return package_.split("/").at(-1) ?? "";
};
