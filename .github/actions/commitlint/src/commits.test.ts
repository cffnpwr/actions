import { describe, expect, test } from "bun:test";

import type { Commit } from "./commits.ts";

import { partitionByEmail } from "./commits.ts";

const commits: Commit[] = [
  { sha: "a1", authorName: "cffnpwr", authorEmail: "cffnpwr@gmail.com", message: "feat: a" },
  {
    sha: "b2",
    authorName: "renovate[bot]",
    authorEmail: "29139614+renovate[bot]@users.noreply.github.com",
    message: "fix(deps): b",
  },
];

describe("partitionByEmail", () => {
  test("[positive] 除外アドレスのコミットとそれ以外を振り分ける", () => {
    // Given
    const ignore = ["29139614+renovate[bot]@users.noreply.github.com"];
    // When
    const { toLint, toSkip } = partitionByEmail(commits, ignore);
    // Then
    expect(toLint.map((c) => c.sha)).toEqual(["a1"]);
    expect(toSkip.map((c) => c.sha)).toEqual(["b2"]);
  });

  test("[negative] 除外リストが空なら振り分けずすべて lint 対象にする", () => {
    // Given / When
    const { toLint, toSkip } = partitionByEmail(commits, []);
    // Then
    expect(toLint.map((c) => c.sha)).toEqual(["a1", "b2"]);
    expect(toSkip).toEqual([]);
  });
});
