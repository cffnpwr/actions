import { describe, expect, test } from "bun:test";

import { hasMergeGroupTrigger } from "./triggers.ts";

describe("hasMergeGroupTrigger", () => {
  test("[positive] mapping 形式の on: から merge_group を検出する", () => {
    // Given: merge_group を含む mapping 形式の on:
    const on = { merge_group: null, push: {} };
    // When: merge_group トリガの有無を判定する
    const result = hasMergeGroupTrigger(on);
    // Then: 検出される
    expect(result).toBe(true);
  });

  test("[positive] sequence 形式の on: から merge_group を検出する", () => {
    // Given: merge_group を含む sequence 形式の on:
    const on = ["push", "merge_group"];
    // When: merge_group トリガの有無を判定する
    const result = hasMergeGroupTrigger(on);
    // Then: 検出される
    expect(result).toBe(true);
  });

  test("[positive] string 形式の on: から merge_group を検出する", () => {
    // Given: merge_group そのものの string 形式の on:
    const on = "merge_group";
    // When: merge_group トリガの有無を判定する
    const result = hasMergeGroupTrigger(on);
    // Then: 検出される
    expect(result).toBe(true);
  });

  test("[negative] merge_group を含まない on: は検出しない", () => {
    // Given: merge_group を含まない各形式の on:
    // When: それぞれ merge_group トリガの有無を判定する
    // Then: いずれも検出されない
    expect(hasMergeGroupTrigger({ push: {} })).toBe(false);
    expect(hasMergeGroupTrigger("push")).toBe(false);
    expect(hasMergeGroupTrigger(["push"])).toBe(false);
  });

  test("[negative] on: が無い場合は検出しない", () => {
    // Given: 値の無い on:
    // When: merge_group トリガの有無を判定する
    // Then: 検出されない
    expect(hasMergeGroupTrigger(undefined)).toBe(false);
    expect(hasMergeGroupTrigger(null)).toBe(false);
  });
});
