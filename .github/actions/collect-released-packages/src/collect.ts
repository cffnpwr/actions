// release-pleaseの出力を正規化し、公開先ごとに振り分ける。

import { existsSync } from "node:fs";
import { join } from "node:path";

export type ReleasedPackage = {
  path: string;
  tag: string;
  sha: string;
};

export type CollectedPackages = {
  npmPackages: ReleasedPackage[];
  jsrPackages: ReleasedPackage[];
  tags: string[];
};

// release-pleaseは、ルート（pathが `.`）を `tag_name`・`sha`、それ以外を
// `<path>--tag_name`・`<path>--sha` という別々の名前で出力する。この差を吸収する。
const readOutput = (
  outputs: Record<string, string>,
  path: string,
  key: string,
): string => (path === "." ? outputs[key] ?? "" : outputs[`${path}--${key}`] ?? "");

const isPrivatePackage = async (manifest: string): Promise<boolean> => {
  const { private: value } = await Bun.file(manifest).json() as { private?: boolean; };
  return value === true;
};

// 公開先はマニフェストの有無で決まる。package.jsonがあり `private` が `true` でなければ
// npmへ、jsr.jsonがあればJSRへ公開する。
export const collectReleasedPackages = async (
  outputs: Record<string, string>,
  rootDir: string,
): Promise<CollectedPackages> => {
  const paths = JSON.parse(outputs.paths_released ?? "[]") as string[];
  const packages: ReleasedPackage[] = paths.map((path) => ({
    path,
    tag: readOutput(outputs, path, "tag_name"),
    sha: readOutput(outputs, path, "sha"),
  }));

  const npmPackages: ReleasedPackage[] = [];
  const jsrPackages: ReleasedPackage[] = [];

  for (const pkg of packages) {
    const manifest = join(rootDir, pkg.path, "package.json");
    if (existsSync(manifest) && !await isPrivatePackage(manifest)) {
      npmPackages.push(pkg);
    }
    if (existsSync(join(rootDir, pkg.path, "jsr.json"))) {
      jsrPackages.push(pkg);
    }
  }

  return { npmPackages, jsrPackages, tags: packages.map((pkg) => pkg.tag) };
};
