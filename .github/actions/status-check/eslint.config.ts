import cffnpwrConfig from "@cffnpwr/eslint-config";
import tsParser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import globals from "globals";

const files = ["src/**/*.ts"];

export default defineConfig([
  {
    files,
    languageOptions: {
      globals: { ...globals.bunBuiltin, Bun: "readonly" },
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files,
    extends: cffnpwrConfig(),
  },
]);
