import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectReleasedPackages } from "./collect.ts";

const createRepo = async (manifests: Record<string, Record<string, unknown>>): Promise<string> => {
  const rootDir = mkdtempSync(join(tmpdir(), "collect-"));
  for (const [path, content] of Object.entries(manifests)) {
    const filePath = join(rootDir, path);
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, JSON.stringify(content));
  }
  return rootDir;
};

describe("collectReleasedPackages", () => {
  it("[positive] リリースされたパスがルートのとき、プレフィックスなしの出力から読む", async () => {
    const rootDir = await createRepo({
      "package.json": { name: "@x/a", version: "1.1.2" },
      "jsr.json": { name: "@x/a", version: "1.1.2" },
    });

    const result = await collectReleasedPackages({
      paths_released: "[\".\"]",
      tag_name: "v1.1.2",
      sha: "aaa",
    }, rootDir);

    expect(result).toEqual({
      npmPackages: [{ path: ".", tag: "v1.1.2", sha: "aaa" }],
      jsrPackages: [{ path: ".", tag: "v1.1.2", sha: "aaa" }],
      tags: ["v1.1.2"],
    });
  });

  it("[positive] リリースされたパスがルート以外のとき、パス付きの出力から読む", async () => {
    const rootDir = await createRepo({
      "packages/a/package.json": { name: "@x/a", version: "1.0.6" },
      "packages/a/jsr.json": { name: "@x/a", version: "1.0.6" },
    });

    const result = await collectReleasedPackages({
      paths_released: "[\"packages/a\"]",
      "packages/a--tag_name": "a-v1.0.6",
      "packages/a--sha": "bbb",
    }, rootDir);

    expect(result).toEqual({
      npmPackages: [{ path: "packages/a", tag: "a-v1.0.6", sha: "bbb" }],
      jsrPackages: [{ path: "packages/a", tag: "a-v1.0.6", sha: "bbb" }],
      tags: ["a-v1.0.6"],
    });
  });

  it("[positive] jsr.jsonが無いとき、npmだけに振り分ける", async () => {
    const rootDir = await createRepo({
      "packages/a/package.json": { name: "@x/a", version: "2.0.0" },
    });

    const result = await collectReleasedPackages({
      paths_released: "[\"packages/a\"]",
      "packages/a--tag_name": "a-v2.0.0",
      "packages/a--sha": "bbb",
    }, rootDir);

    expect(result).toEqual({
      npmPackages: [{ path: "packages/a", tag: "a-v2.0.0", sha: "bbb" }],
      jsrPackages: [],
      tags: ["a-v2.0.0"],
    });
  });

  it("[positive] package.jsonが無いとき、JSRだけに振り分ける", async () => {
    const rootDir = await createRepo({
      "packages/a/jsr.json": { name: "@x/a", version: "2.0.0" },
    });

    const result = await collectReleasedPackages({
      paths_released: "[\"packages/a\"]",
      "packages/a--tag_name": "a-v2.0.0",
      "packages/a--sha": "bbb",
    }, rootDir);

    expect(result).toEqual({
      npmPackages: [],
      jsrPackages: [{ path: "packages/a", tag: "a-v2.0.0", sha: "bbb" }],
      tags: ["a-v2.0.0"],
    });
  });

  // privateなパッケージにもrelease-pleaseはタグとdraft releaseを作るため、
  // 公開先からは外しつつタグの一覧には残す。
  it("[positive] privateなパッケージのとき、npmへ振り分けずタグだけ残す", async () => {
    const rootDir = await createRepo({
      "packages/a/package.json": { name: "@x/a", version: "0.1.0", private: true },
    });

    const result = await collectReleasedPackages({
      paths_released: "[\"packages/a\"]",
      "packages/a--tag_name": "a-v0.1.0",
      "packages/a--sha": "ccc",
    }, rootDir);

    expect(result).toEqual({
      npmPackages: [],
      jsrPackages: [],
      tags: ["a-v0.1.0"],
    });
  });

  it("[positive] 複数のパスがリリースされたとき、すべてを振り分ける", async () => {
    const rootDir = await createRepo({
      "packages/a/package.json": { name: "@x/a", version: "1.0.6" },
      "packages/a/jsr.json": { name: "@x/a", version: "1.0.6" },
      "packages/b/package.json": { name: "@x/b", version: "2.0.0" },
    });

    const result = await collectReleasedPackages({
      paths_released: "[\"packages/a\",\"packages/b\"]",
      "packages/a--tag_name": "a-v1.0.6",
      "packages/a--sha": "bbb",
      "packages/b--tag_name": "b-v2.0.0",
      "packages/b--sha": "bbb",
    }, rootDir);

    expect(result).toEqual({
      npmPackages: [
        { path: "packages/a", tag: "a-v1.0.6", sha: "bbb" },
        { path: "packages/b", tag: "b-v2.0.0", sha: "bbb" },
      ],
      jsrPackages: [{ path: "packages/a", tag: "a-v1.0.6", sha: "bbb" }],
      tags: ["a-v1.0.6", "b-v2.0.0"],
    });
  });

  it("[positive] リリースが無いとき、すべて空になる", async () => {
    const rootDir = await createRepo({});

    const result = await collectReleasedPackages({ paths_released: "[]" }, rootDir);

    expect(result).toEqual({ npmPackages: [], jsrPackages: [], tags: [] });
  });

  // release-pleaseはリリースを作らなかった実行で paths_released 自体を出力しない。
  it("[positive] paths_releasedが無いとき、すべて空になる", async () => {
    const rootDir = await createRepo({});

    const result = await collectReleasedPackages({}, rootDir);

    expect(result).toEqual({ npmPackages: [], jsrPackages: [], tags: [] });
  });

  it("[positive] タグとSHAの出力が無いとき、空文字として扱う", async () => {
    const rootDir = await createRepo({
      "packages/a/package.json": { name: "@x/a", version: "1.0.0" },
    });

    const result = await collectReleasedPackages({
      paths_released: "[\"packages/a\"]",
    }, rootDir);

    expect(result).toEqual({
      npmPackages: [{ path: "packages/a", tag: "", sha: "" }],
      jsrPackages: [],
      tags: [""],
    });
  });
});
