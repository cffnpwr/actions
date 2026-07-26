import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  resolveWorkspaceDeps,
  UnsupportedWorkspaceProtocolError,
  WorkspacePackageNotFoundError,
} from "./resolve.ts";

const createRepo = async (manifests: Record<string, Record<string, unknown>>): Promise<string> => {
  const rootDir = mkdtempSync(join(tmpdir(), "resolve-"));
  for (const [path, content] of Object.entries(manifests)) {
    const filePath = join(rootDir, path);
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, JSON.stringify(content));
  }
  return rootDir;
};

const noWait = async (): Promise<void> => {};

describe("resolveWorkspaceDeps", () => {
  it.each([
    { protocol: "workspace:*", want: "2.0.0" },
    { protocol: "workspace:^", want: "^2.0.0" },
    { protocol: "workspace:~", want: "~2.0.0" },
  ])("[positive] 依存が $protocol のとき $want へ解決する", async ({ protocol, want }) => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: ["packages/*"] },
      "packages/a/package.json": { name: "@x/a", version: "2.0.0" },
      "packages/b/package.json": {
        name: "@x/b",
        version: "2.0.0",
        dependencies: { "@x/a": protocol },
      },
    });

    const resolved = await resolveWorkspaceDeps(rootDir, "packages/b", noWait);

    expect(resolved).toEqual({ "@x/a": want });
  });

  it("[positive] workspace以外の依存が混ざるとき、それらを保ったままpackage.jsonを書き換える", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: ["packages/*"] },
      "packages/a/package.json": { name: "@x/a", version: "2.0.0" },
      "packages/b/package.json": {
        name: "@x/b",
        version: "2.0.0",
        dependencies: { "@x/a": "workspace:*", arktype: "2.2.3" },
      },
    });

    await resolveWorkspaceDeps(rootDir, "packages/b", noWait);

    expect(await Bun.file(join(rootDir, "packages/b/package.json")).json()).toEqual({
      name: "@x/b",
      version: "2.0.0",
      dependencies: { "@x/a": "2.0.0", arktype: "2.2.3" },
    });
  });

  it("[positive] workspacesがオブジェクト形式のとき解決する", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: { packages: ["packages/*"] } },
      "packages/a/package.json": { name: "@x/a", version: "3.0.0" },
      "packages/b/package.json": {
        name: "@x/b",
        version: "3.0.0",
        dependencies: { "@x/a": "workspace:*" },
      },
    });

    const resolved = await resolveWorkspaceDeps(rootDir, "packages/b", noWait);

    expect(resolved).toEqual({ "@x/a": "3.0.0" });
  });

  it("[positive] 依存先を解決する前に公開を待つ", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: ["packages/*"] },
      "packages/a/package.json": { name: "@x/a", version: "2.0.0" },
      "packages/b/package.json": {
        name: "@x/b",
        version: "2.0.0",
        dependencies: { "@x/a": "workspace:*" },
      },
    });

    const waited: string[] = [];
    await resolveWorkspaceDeps(rootDir, "packages/b", async (name, version) => {
      waited.push(`${name}@${version}`);
    });

    expect(waited).toEqual(["@x/a@2.0.0"]);
  });

  // 単一パッケージのリポジトリはworkspacesを持たないため、この経路を必ず通る。
  it("[positive] workspace依存が無いとき何も解決しない", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "@x/single", version: "1.0.0", dependencies: { arktype: "2.2.3" } },
    });

    const resolved = await resolveWorkspaceDeps(rootDir, ".", noWait);

    expect(resolved).toEqual({});
  });

  it("[positive] 依存を持たないとき何も解決しない", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "@x/single", version: "1.0.0" },
    });

    const resolved = await resolveWorkspaceDeps(rootDir, ".", noWait);

    expect(resolved).toEqual({});
  });

  it("[negative] 対応していないworkspace protocolのときUnsupportedWorkspaceProtocolErrorを投げる", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: ["packages/*"] },
      "packages/a/package.json": { name: "@x/a", version: "2.0.0" },
      "packages/b/package.json": {
        name: "@x/b",
        version: "2.0.0",
        dependencies: { "@x/a": "workspace:1.2.3" },
      },
    });

    await expect(resolveWorkspaceDeps(rootDir, "packages/b", noWait))
      .rejects.toBeInstanceOf(UnsupportedWorkspaceProtocolError);
  });

  it("[negative] 依存先がworkspaceに無いときWorkspacePackageNotFoundErrorを投げる", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: ["packages/*"] },
      "packages/b/package.json": {
        name: "@x/b",
        version: "1.0.0",
        dependencies: { "@x/missing": "workspace:*" },
      },
    });

    await expect(resolveWorkspaceDeps(rootDir, "packages/b", noWait))
      .rejects.toBeInstanceOf(WorkspacePackageNotFoundError);
  });

  it("[negative] workspacesがオブジェクトでpackagesを持たないとき依存先を解決できない", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: {} },
      "packages/b/package.json": {
        name: "@x/b",
        version: "1.0.0",
        dependencies: { "@x/a": "workspace:*" },
      },
    });

    await expect(resolveWorkspaceDeps(rootDir, "packages/b", noWait))
      .rejects.toBeInstanceOf(WorkspacePackageNotFoundError);
  });

  // versionを持たないパッケージはworkspaceの表に載らないため、依存先として解決できない。
  it("[negative] 依存先がversionを持たないときWorkspacePackageNotFoundErrorを投げる", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "root", private: true, workspaces: ["packages/*"] },
      "packages/a/package.json": { name: "@x/a" },
      "packages/b/package.json": {
        name: "@x/b",
        version: "1.0.0",
        dependencies: { "@x/a": "workspace:*" },
      },
    });

    await expect(resolveWorkspaceDeps(rootDir, "packages/b", noWait))
      .rejects.toBeInstanceOf(WorkspacePackageNotFoundError);
  });
});
