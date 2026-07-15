import { describe, expect, test } from "bun:test";

import { isIgnoredEmail, parseIgnoreEmails } from "./authors.ts";

describe("parseIgnoreEmails", () => {
  test("[positive] 改行区切りの入力を1行1アドレスに分解する", () => {
    // Given
    const raw = "renovate[bot]@example.com\ndependabot[bot]@example.com";
    // When
    const emails = parseIgnoreEmails(raw);
    // Then
    expect(emails).toEqual(["renovate[bot]@example.com", "dependabot[bot]@example.com"]);
  });

  test("[positive] 空行と前後の空白を取り除く", () => {
    // Given
    const raw = "  a@example.com  \n\n\n  \n";
    // When
    const emails = parseIgnoreEmails(raw);
    // Then
    expect(emails).toEqual(["a@example.com"]);
  });

  test("[negative] 空文字列は除外対象なしになる", () => {
    // Given / When / Then
    expect(parseIgnoreEmails("")).toEqual([]);
  });
});

describe("isIgnoredEmail", () => {
  const ignore = ["29139614+renovate[bot]@users.noreply.github.com"];

  test("[positive] アドレスが完全一致すれば除外する", () => {
    // Given / When
    const result = isIgnoredEmail("29139614+renovate[bot]@users.noreply.github.com", ignore);
    // Then
    expect(result).toBe(true);
  });

  test("[positive] 大文字小文字の違いは無視して一致とみなす", () => {
    // Given / When
    const result = isIgnoredEmail("29139614+Renovate[BOT]@Users.NoReply.GitHub.com", ignore);
    // Then
    expect(result).toBe(true);
  });

  test("[negative] リストにないアドレスは除外しない", () => {
    // Given / When
    const result = isIgnoredEmail("cffnpwr@gmail.com", ignore);
    // Then
    expect(result).toBe(false);
  });

  test("[negative] 除外リストが空なら除外しない", () => {
    // Given / When
    const result = isIgnoredEmail("renovate[bot]@example.com", []);
    // Then
    expect(result).toBe(false);
  });
});
