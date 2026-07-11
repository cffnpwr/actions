import { describe, expect, test } from "bun:test";

import type { Run } from "./state.ts";

import { evaluateState } from "./state.ts";

const SELF = ".github/workflows/status-check.yaml";
const TEST = ".github/workflows/test.yaml";
const ESLINT = ".github/workflows/eslint.yaml";

const run = (path: string, status: string, conclusion: string | null, id = 1): Run => {
  return { path, status, conclusion, id };
};

describe("evaluateState", () => {
  const expected = [TEST, ESLINT];

  test("[positive] 期待する workflow がすべて成功すれば done", () => {
    // Given: 期待する workflow がいずれも成功で completed
    const runs = [
      run(TEST, "completed", "success"),
      run(ESLINT, "completed", "skipped"),
      run(SELF, "in_progress", null),
    ];
    // When: 集約状態を評価する
    const state = evaluateState(expected, runs, SELF);
    // Then: done になる
    expect(state).toBe("done");
  });

  test("[positive] 期待する workflow が実行中なら pending", () => {
    // Given: 期待する workflow の 1 つがまだ実行中
    const runs = [
      run(TEST, "in_progress", null),
      run(ESLINT, "completed", "success"),
    ];
    // When: 集約状態を評価する
    const state = evaluateState(expected, runs, SELF);
    // Then: 待機を続ける
    expect(state).toBe("pending");
  });

  test("[positive] 期待する workflow の run が未登録なら pending", () => {
    // Given: 期待する workflow の run がまだ登録されていない
    const runs = [run(TEST, "completed", "success")];
    // When: 集約状態を評価する
    const state = evaluateState(expected, runs, SELF);
    // Then: 待機を続ける
    expect(state).toBe("pending");
  });

  test("[positive] run が 1 つも無ければ pending", () => {
    // Given: run がまだ 1 つも登録されていない
    const runs: Run[] = [];
    // When: 集約状態を評価する
    const state = evaluateState(expected, runs, SELF);
    // Then: 空振り合格せず待機を続ける
    expect(state).toBe("pending");
  });

  test("[positive] 自身の run は無視する", () => {
    // Given: 期待する workflow は成功し、自身の run は実行中
    const runs = [
      run(TEST, "completed", "success"),
      run(SELF, "in_progress", null),
    ];
    // When: 期待集合を 1 件として集約状態を評価する
    const state = evaluateState([TEST], runs, SELF);
    // Then: 自身を待たずに done になる
    expect(state).toBe("done");
  });

  test("[positive] 同一 workflow は最新の run を採用する", () => {
    // Given: 失敗した古い run を成功した新しい run が上書きしている
    const runs = [
      run(TEST, "completed", "failure", 1),
      run(TEST, "completed", "success", 2),
      run(ESLINT, "completed", "success", 3),
    ];
    // When: 集約状態を評価する
    const state = evaluateState(expected, runs, SELF);
    // Then: 最新の run のみが効き done になる
    expect(state).toBe("done");
  });

  test("[negative] 期待する workflow が失敗すれば fail", () => {
    // Given: 期待する workflow の 1 つが失敗で completed
    const runs = [
      run(TEST, "completed", "failure"),
      run(ESLINT, "completed", "success"),
    ];
    // When: 集約状態を評価する
    const state = evaluateState(expected, runs, SELF);
    // Then: fail になる
    expect(state).toBe("fail");
  });

  test("[negative] 失敗は実行中の workflow より優先される", () => {
    // Given: 期待する workflow の 1 つが失敗し、別の 1 つは実行中
    const runs = [
      run(TEST, "completed", "failure"),
      run(ESLINT, "in_progress", null),
    ];
    // When: 集約状態を評価する
    const state = evaluateState(expected, runs, SELF);
    // Then: 失敗が結果を決める
    expect(state).toBe("fail");
  });
});
