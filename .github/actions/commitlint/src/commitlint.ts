// commitlint config resolution and linting, using the @commitlint/* APIs
// directly instead of spawning the CLI.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { QualifiedConfig } from "@commitlint/types";

import lint from "@commitlint/lint";
import load from "@commitlint/load";

// commitlint config extended when the target repository defines no rules of its
// own. Bundled as a dependency of this action and resolved from its directory.
const FALLBACK_CONFIG = "@cffnpwr/commitlint-config";

// Resolve the commitlint config for the target repository.
// Precedence: an explicit config file, then the repository's own auto-discovered
// config (when it defines rules), then the bundled @cffnpwr/commitlint-config.
//
// The fallback is loaded by its resolved file path rather than by extends, so
// @commitlint/load treats it as an explicit config and skips cosmiconfig's
// upward directory search — which would otherwise pick up an unrelated config
// living above this action's directory.
export const loadConfig = async (
  repoPath: string,
  configFile?: string,
): Promise<QualifiedConfig> => {
  if (configFile) {
    return load({}, { cwd: repoPath, file: configFile });
  }
  const repo = await load({}, { cwd: repoPath });
  if (Object.keys(repo.rules).length > 0) return repo;
  // Load the bundled config by file path. cwd is this action's package root
  // (not src/) so @commitlint/load selects its ESM loader from the package
  // "type": "module", which is required to read the ESM config module.
  const packageRoot = resolve(import.meta.dir, "..");
  const fallbackFile = fileURLToPath(import.meta.resolve(FALLBACK_CONFIG));
  return load({}, { cwd: packageRoot, file: fallbackFile });
};

// The options object accepted by @commitlint/lint, used to type the parserOpts
// that @commitlint/load exposes as `unknown`.
type LintOptions = NonNullable<Parameters<typeof lint>[2]>;

export type LintResult = { valid: boolean; report: string; };

// Lint one commit message against a resolved config.
export const runCommitlint = async (
  message: string,
  config: QualifiedConfig,
): Promise<LintResult> => {
  const result = await lint(message, config.rules, {
    plugins: config.plugins,
    ignores: config.ignores,
    defaultIgnores: config.defaultIgnores,
    helpUrl: config.helpUrl,
    parserOpts: config.parserPreset?.parserOpts as LintOptions["parserOpts"],
  });
  if (result.valid) return { valid: true, report: "" };
  const report = [
    ...result.errors.map((o) => `error: ${o.message} [${o.name}]`),
    ...result.warnings.map((o) => `warn: ${o.message} [${o.name}]`),
  ].join("\n");
  return { valid: false, report };
};
