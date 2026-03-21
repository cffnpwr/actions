import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { type } from "arktype";

import type { OptionalOption, Provider, ProviderFactory } from "./base.ts";

import { resolveBin } from "../utils/resolveBin.ts";

import { ProviderError } from "./errors.ts";

const miseTool = type({
  version: "string",
  "requested_version?": "string",
  install_path: "string",
  "source?": { type: "string", path: "string" },
  installed: "boolean",
  active: "boolean",
});

const parseMiseOutput = type("string.json.parse").pipe(
  type({ "[string]": miseTool.array() }),
);

const OPTION_PROJECT_DIR = {
  required: false,
  name: "--project-dir",
  type: "string",
  default: ".",
  help: "Path to the project directory containing mise.toml",
} as const satisfies OptionalOption;

const OPTION_MISE_BIN = {
  required: false,
  name: "--mise-bin",
  type: "string",
  help: "Path to the mise binary (default: resolved from PATH)",
} as const satisfies OptionalOption;

const createMiseProvider = (projectDir: string, miseBin: string): Provider => {
  return {
    async fetchToolVersions(): Promise<
      Result<Record<string, string>, ProviderError>
    > {
      const spawnResult = Bun.spawnSync([miseBin, "list", "--json"], {
        cwd: projectDir,
      });

      if (spawnResult.exitCode !== 0) {
        return Err(
          new ProviderError(
            `failed to run mise: ${spawnResult.stderr.toString()}`,
          ),
        );
      }

      const validated = parseMiseOutput(spawnResult.stdout.toString());
      if (validated instanceof type.errors) {
        return Err(
          new ProviderError(
            `failed to parse mise output: ${validated.summary}`,
          ),
        );
      }

      const versions: Record<string, string> = {};
      for (const [name, tools] of Object.entries(validated)) {
        const active = tools.find((t) => t.active);
        if (active !== undefined) {
          versions[name] = active.version;
        }
      }

      return Ok(versions);
    },
  };
};

export const miseProviderFactory: ProviderFactory = {
  sourceName: "mise",

  getOptions(): OptionalOption[] {
    return [OPTION_PROJECT_DIR, OPTION_MISE_BIN];
  },

  create(args: Record<string, unknown>): Result<Provider, ProviderError> {
    const projectDirArg = args[OPTION_PROJECT_DIR.name.slice(2)];
    const projectDir = typeof projectDirArg === "string" && projectDirArg !== ""
      ? projectDirArg
      : OPTION_PROJECT_DIR.default;

    const miseBinArg = args[OPTION_MISE_BIN.name.slice(2)];
    if (typeof miseBinArg === "string" && miseBinArg !== "") {
      return Ok(createMiseProvider(projectDir, miseBinArg));
    }

    const resolved = resolveBin("mise");
    if (resolved.isNone()) {
      return Err(new ProviderError("mise is not found in PATH"));
    }

    return Ok(createMiseProvider(projectDir, resolved.unwrap()));
  },
};
