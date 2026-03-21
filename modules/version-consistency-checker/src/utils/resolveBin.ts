import type { Option } from "@cffnpwr/result-ts";

import { None, Some } from "@cffnpwr/result-ts";

/**
 * Resolves a bare binary name to its absolute path by searching PATH.
 *
 * Returns Some(absolutePath) if found, or None() if:
 * - the name is empty
 * - the name contains a slash (path-like inputs are not searched in PATH)
 * - the binary is not found in PATH
 */
export const resolveBin = (name: string): Option<string> => {
  if (name === "" || name.includes("/")) {
    return None();
  }

  const path = Bun.which(name);
  if (path === null) {
    return None();
  }

  return Some(path);
};
