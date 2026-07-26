// パッケージ間の `workspace:` 依存を、依存先の実際のversionへ解決する。
//
// `bun pm pack` は `workspace:` 依存をbun.lockに記録されたversionで置換するが、
// bun installはrelease-pleaseがbumpしたversionをbun.lockへ再同期しない。
// そのままpackすると、公開物のパッケージ間依存が前のバージョンを指す。
// packの前にpackage.json側で解決しておくことで、bun.lockの内容に依存しなくなる。
// 参照: https://github.com/oven-sh/bun/issues/18906

import { join } from "node:path";

// `bun pm pack` と同じ対応付け。`workspace:*` は完全一致、`workspace:^` と
// `workspace:~` はそれぞれのrange指定子を付けたものへ展開される。
const RANGE_PREFIXES: Record<string, string> = {
  "*": "",
  "^": "^",
  "~": "~",
};

const PROTOCOL = "workspace:";

export class UnsupportedWorkspaceProtocolError extends Error {
  constructor(name: string, protocol: string) {
    super(`Unsupported workspace protocol \`${protocol}\` for ${name}`);
    this.name = "UnsupportedWorkspaceProtocolError";
  }
}

export class WorkspacePackageNotFoundError extends Error {
  constructor(name: string) {
    super(`Could not find workspace package for dependency ${name}`);
    this.name = "WorkspacePackageNotFoundError";
  }
}

export type WaitForPublish = (name: string, version: string) => Promise<void>;

type Manifest = {
  name?: string;
  version?: string;
  workspaces?: string[] | { packages?: string[]; };
  dependencies?: Record<string, string>;
};

const readManifest = async (path: string): Promise<Manifest> => await Bun.file(path).json() as Manifest;

const workspacePatterns = (root: Manifest): string[] => {
  const { workspaces } = root;
  if (!workspaces) {
    return [];
  }
  return Array.isArray(workspaces) ? workspaces : workspaces.packages ?? [];
};

// workspaceパッケージの名前からversionを引く表を作る。
const readWorkspaceVersions = async (rootDir: string): Promise<Map<string, string>> => {
  const root = await readManifest(join(rootDir, "package.json"));
  const versions = new Map<string, string>();

  for (const pattern of workspacePatterns(root)) {
    const glob = new Bun.Glob(`${pattern}/package.json`);
    for await (const relativePath of glob.scan({ cwd: rootDir })) {
      const { name, version } = await readManifest(join(rootDir, relativePath));
      if (name && version) {
        versions.set(name, version);
      }
    }
  }

  return versions;
};

const resolveRange = (name: string, protocolSuffix: string, version: string): string => {
  const prefix = RANGE_PREFIXES[protocolSuffix];
  if (prefix === undefined) {
    throw new UnsupportedWorkspaceProtocolError(name, `${PROTOCOL}${protocolSuffix}`);
  }
  return `${prefix}${version}`;
};

// 対象パッケージの `workspace:` 依存を解決し、package.jsonを書き換える。
// 同一リリースに含まれるパッケージは並行して公開されるため、依存先がレジストリに
// 現れるまで待ってから書き換える。待たずに公開すると利用側でインストールが壊れる。
export const resolveWorkspaceDeps = async (
  rootDir: string,
  packagePath: string,
  waitForPublish: WaitForPublish,
): Promise<Record<string, string>> => {
  const manifestPath = join(rootDir, packagePath, "package.json");
  const manifest = await readManifest(manifestPath);
  const dependencies = manifest.dependencies ?? {};

  const workspaceDeps = Object.entries(dependencies)
    .filter(([, range]) => range.startsWith(PROTOCOL))
    .map(([name, range]) => [name, range.slice(PROTOCOL.length)] as const);
  if (workspaceDeps.length === 0) {
    return {};
  }

  const versions = await readWorkspaceVersions(rootDir);
  const resolved: Record<string, string> = {};

  for (const [name, protocolSuffix] of workspaceDeps) {
    const version = versions.get(name);
    if (!version) {
      throw new WorkspacePackageNotFoundError(name);
    }

    const range = resolveRange(name, protocolSuffix, version);
    await waitForPublish(name, version);
    resolved[name] = range;
  }

  await Bun.write(
    manifestPath,
    `${JSON.stringify({ ...manifest, dependencies: { ...dependencies, ...resolved } }, null, 2)}\n`,
  );

  return resolved;
};
