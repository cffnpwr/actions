import type { Result } from "@cffnpwr/result-ts";

import { Err, Ok } from "@cffnpwr/result-ts";
import { type } from "arktype";

import type { OptionalOption, Provider, ProviderFactory } from "./base.ts";

import { resolveBin } from "../utils/resolveBin.ts";

import { ProviderError } from "./errors.ts";

const nixPackage = type({ name: "string", version: "string" });

const parseNixOutput = type("string.json.parse").pipe(nixPackage.array());

const NIX_EVAL_APPLY = "pkgs: map (p: { name = p.pname or p.name; version = p.version or \"\"; }) pkgs";

const OPTION_FLAKE_DIR = {
  required: false,
  name: "--flake-dir",
  type: "string",
  default: ".",
  help: "Path to the directory containing flake.nix",
} as const satisfies OptionalOption;

const OPTION_NIX_BIN = {
  required: false,
  name: "--nix-bin",
  type: "string",
  help: "Path to the nix binary (default: resolved from PATH)",
} as const satisfies OptionalOption;

const createNixProvider = (flakeDir: string, nixBin: string): Provider => {
  return {
    async fetchToolVersions(): Promise<
      Result<Record<string, string>, ProviderError>
    > {
      // Step 1: get current system
      const systemResult = Bun.spawnSync([
        nixBin,
        "eval",
        "--raw",
        "--impure",
        "--expr",
        "builtins.currentSystem",
      ]);

      if (systemResult.exitCode !== 0) {
        return Err(
          new ProviderError(
            `failed to get current system: ${systemResult.stderr.toString()}`,
          ),
        );
      }

      const system = systemResult.stdout.toString().trim();
      const attr = `${flakeDir}#devShells.${system}.default.nativeBuildInputs`;

      // Step 2: eval packages
      const pkgResult = Bun.spawnSync(
        [nixBin, "eval", "--json", attr, "--apply", NIX_EVAL_APPLY],
        { cwd: flakeDir },
      );

      if (pkgResult.exitCode !== 0) {
        return Err(
          new ProviderError(
            `failed to run nix eval: ${pkgResult.stderr.toString()}`,
          ),
        );
      }

      const validated = parseNixOutput(pkgResult.stdout.toString());
      if (validated instanceof type.errors) {
        return Err(
          new ProviderError(
            `failed to parse nix eval output: ${validated.summary}`,
          ),
        );
      }

      const versions: Record<string, string> = {};
      for (const pkg of validated) {
        if (pkg.version !== "") {
          versions[pkg.name] = pkg.version;
        }
      }

      return Ok(versions);
    },
  };
};

export const nixProviderFactory: ProviderFactory = {
  sourceName: "nix",

  getOptions(): OptionalOption[] {
    return [OPTION_FLAKE_DIR, OPTION_NIX_BIN];
  },

  create(args: Record<string, unknown>): Result<Provider, ProviderError> {
    const flakeDirArg = args[OPTION_FLAKE_DIR.name.slice(2)];
    const flakeDir = typeof flakeDirArg === "string" && flakeDirArg !== ""
      ? flakeDirArg
      : OPTION_FLAKE_DIR.default;

    const nixBinArg = args[OPTION_NIX_BIN.name.slice(2)];
    if (typeof nixBinArg === "string" && nixBinArg !== "") {
      return Ok(createNixProvider(flakeDir, nixBinArg));
    }

    const resolved = resolveBin("nix");
    if (resolved.isNone()) {
      return Err(new ProviderError("nix is not found in PATH"));
    }

    return Ok(createNixProvider(flakeDir, resolved.unwrap()));
  },
};
