import { appendFileSync } from "node:fs";

import { collectReleasedPackages } from "./collect.ts";

const { RELEASE_OUTPUTS, GITHUB_OUTPUT } = process.env;

if (!GITHUB_OUTPUT) {
  throw new Error("GITHUB_OUTPUT is not set");
}

const outputs = JSON.parse(RELEASE_OUTPUTS ?? "{}") as Record<string, string>;
const { npmPackages, jsrPackages, tags } = await collectReleasedPackages(outputs, process.cwd());

appendFileSync(
  GITHUB_OUTPUT,
  [
    `npm-packages=${JSON.stringify(npmPackages)}`,
    `jsr-packages=${JSON.stringify(jsrPackages)}`,
    `tags=${JSON.stringify(tags)}`,
    "",
  ].join("\n"),
);
