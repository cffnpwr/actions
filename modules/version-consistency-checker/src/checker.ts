import { normalizeToolName } from "./utils/normalizeToolName.ts";

export interface Mismatch {
  tool: string;
  nixVersion: string;
  mismatchedSources: Record<string, string>;
}

/**
 * Checks version consistency between nix devshell and one or more sources.
 *
 * For each tool in nixVersions, compares against each source after normalizing
 * source tool names. Returns mismatches where at least one source disagrees.
 */
export const checkConsistency = (
  nixVersions: Record<string, string>,
  sources: Record<string, Record<string, string>>,
): Mismatch[] => {
  const mismatches: Mismatch[] = [];

  for (const [tool, nixVersion] of Object.entries(nixVersions)) {
    const mismatchedSources: Record<string, string> = {};

    for (const [sourceName, rawVersions] of Object.entries(sources)) {
      const normalized = Object.fromEntries(
        Object.entries(rawVersions).map(([k, v]) => [normalizeToolName(k), v]),
      );
      const sourceVersion = normalized[tool];

      if (sourceVersion === undefined) {
        continue;
      }

      if (sourceVersion !== nixVersion) {
        mismatchedSources[sourceName] = sourceVersion;
      }
    }

    if (Object.keys(mismatchedSources).length > 0) {
      mismatches.push({ tool, nixVersion, mismatchedSources });
    }
  }

  return mismatches;
};
