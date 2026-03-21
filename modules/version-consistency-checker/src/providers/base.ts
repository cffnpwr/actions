import type { ParseArgsOptionsType } from "util";

import type { Result } from "@cffnpwr/result-ts";
import type { Type } from "arktype";

import { type } from "arktype";

import type { ProviderError } from "./errors.ts";

type ValueOf<T extends ParseArgsOptionsType> = T extends "boolean"
  ? boolean
  : string;

function makeOptionSchema<T extends ParseArgsOptionsType>(
  required: true,
  valueType: T,
): Type<{
  required: true;
  name: string;
  short?: string;
  type: T;
  help?: string;
}>;
function makeOptionSchema<T extends ParseArgsOptionsType>(
  required: false,
  valueType: T,
): Type<{
  required: false;
  name: string;
  short?: string;
  type: T;
  default?: ValueOf<T>;
  help?: string;
}>;
function makeOptionSchema<T extends ParseArgsOptionsType>(
  required: boolean,
  valueType: T,
): Type {
  return type({
    required: (required ? "true" : "false") as never,
    name: "string",
    "short?": "string.alpha == 1",
    type: `'${valueType}'` as never,
    "default?": (required ? undefined : valueType) as never,
    "help?": "string",
  });
}

export const requiredOptionSchema = makeOptionSchema(true, "string").or(
  makeOptionSchema(true, "boolean"),
);

export const optionalOptionSchema = makeOptionSchema(false, "string").or(
  makeOptionSchema(false, "boolean"),
);

export const optionSchema = requiredOptionSchema.or(optionalOptionSchema);

export type RequiredOption = typeof requiredOptionSchema.infer;
export type OptionalOption = typeof optionalOptionSchema.infer;
export type Option = typeof optionSchema.infer;

/**
 * Factory for a provider, containing metadata and creation logic.
 */
export interface ProviderFactory {
  /** The name of the provider used in outputs (e.g., "mise") */
  readonly sourceName: string;

  /** Defines the CLI options required by this provider */
  getOptions(): Option[];

  /** Creates the provider instance using parsed CLI arguments */
  create(args: Record<string, unknown>): Result<Provider, ProviderError>;
}

/**
 * Provider instance that fetches tool versions.
 */
export interface Provider {
  /** Fetches a mapping of tool names to their versions */
  fetchToolVersions(): Promise<Result<Record<string, string>, ProviderError>>;
}
