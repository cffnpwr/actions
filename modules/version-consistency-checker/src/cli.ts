import type { ParseArgsOptionDescriptor, ParseArgsOptionsConfig } from "util";

import { parseArgs } from "util";

import type { ProviderFactory } from "./providers/base.ts";

import pkg from "../package.json" with { type: "json" };

import { checkConsistency } from "./checker.ts";
import { providers } from "./providers/index.ts";

const commandName = pkg.name;

/**
 * Builds a parseArgs options config from all registered provider factories.
 */
const buildParseArgsOptions = (
  factories: ProviderFactory[],
): ParseArgsOptionsConfig => {
  const opts: ParseArgsOptionsConfig = {
    help: { type: "boolean", short: "h" },
  };

  for (const factory of factories) {
    for (const option of factory.getOptions()) {
      // Strip leading "--" to get the key name
      const key = option.name.replace(/^--/, "");
      const entry: ParseArgsOptionDescriptor = {
        type: option.type,
      };
      if (option.short) {
        entry.short = option.short;
      }
      if (!option.required && "default" in option) {
        entry.default = option.default;
      }
      opts[key] = entry;
    }
  }

  return opts;
};

/**
 * Prints help text derived from all registered provider factories.
 */
const printHelp = (factories: ProviderFactory[]): void => {
  console.log(`Usage: ${commandName} [options]`);
  console.log("");
  const allOptions = factories.flatMap((f) => f.getOptions());
  const flagStrings = allOptions.map((option) => {
    const longFlag = option.type === "boolean" ? option.name : `${option.name} <${option.type}>`;
    const shortPart = option.short ? `-${option.short}, ` : "    ";
    return `${shortPart}${longFlag}`;
  });
  const helpFlag = "-h, --help";
  const maxFlagLen = Math.max(helpFlag.length, ...flagStrings.map((s) => s.length));

  console.log("Options:");
  console.log(`  ${helpFlag.padEnd(maxFlagLen)}    Show this help message`);

  for (let i = 0; i < allOptions.length; i++) {
    const option = allOptions[i];
    const flags = flagStrings[i];
    if (option === undefined || flags === undefined) continue;
    const helpText = option.help ?? "";
    const defaultPart = !option.required && "default" in option && option.default !== undefined
      ? `  [default: ${option.default}]`
      : option.required
        ? "  [required]"
        : "";
    console.log(`  ${flags.padEnd(maxFlagLen)}    ${helpText}${defaultPart}`);
  }
};

export const run = async (): Promise<void> => {
  const options = buildParseArgsOptions(providers);
  const { values } = parseArgs({ options, strict: false });

  if (values.help) {
    printHelp(providers);
    process.exit(0);
  }

  // Create all providers
  const providerResults = providers.map((factory) => factory.create(values));

  const errors = providerResults.filter((r) => r.isErr());
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`Error: ${err.unwrapErr().message}`);
    }
    process.exit(1);
  }

  const createdProviders = providerResults.map((r) => r.unwrap());

  // Fetch versions from all providers in parallel
  const versionResults = await Promise.all(
    createdProviders.map((p) => p.fetchToolVersions()),
  );

  const fetchErrors = versionResults.filter((r) => r.isErr());
  if (fetchErrors.length > 0) {
    for (const err of fetchErrors) {
      console.error(`Error: ${err.unwrapErr().message}`);
    }
    process.exit(1);
  }

  // Build a map of sourceName -> versions
  const versionsBySource: Record<string, Record<string, string>> = {};
  for (let i = 0; i < providers.length; i++) {
    const factory = providers[i];
    const result = versionResults[i];
    if (factory !== undefined && result !== undefined) {
      versionsBySource[factory.sourceName] = result.unwrap();
    }
  }

  // Nix is the baseline; compare other sources against it
  const nixVersions = versionsBySource.nix ?? {};
  const otherSources = Object.fromEntries(
    Object.entries(versionsBySource).filter(([name]) => name !== "nix"),
  );

  const mismatches = checkConsistency(nixVersions, otherSources);

  if (mismatches.length === 0) {
    console.log("All versions are consistent.");
    process.exit(0);
  }

  console.error("Version mismatches found:");
  for (const mismatch of mismatches) {
    console.error(`  ${mismatch.tool}:`);
    console.error(`    nix: ${mismatch.nixVersion}`);
    for (const [source, version] of Object.entries(
      mismatch.mismatchedSources,
    )) {
      console.error(`    ${source}: ${version}`);
    }
  }
  process.exit(1);
};
