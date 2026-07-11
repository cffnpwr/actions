import { describe, expect, test } from "bun:test";

import type { CheckRun, CommitStatus } from "./checks.ts";

import { evaluatePrChecks } from "./checks.ts";

const SELF_SUITE = 1;
const OTHER_SUITE = 2;

const checkRun = (
  status: string,
  conclusion: string | null,
  checkSuiteId = OTHER_SUITE,
  name = "check",
): CheckRun => {
  return { name, checkSuiteId, status, conclusion };
};

const status = (state: string): CommitStatus => {
  return { state };
};

describe("evaluatePrChecks", () => {
  test("[positive] すべての check-run が成功すれば done", () => {
    // Given: 自身以外の check-run がいずれも成功
    const runs = [
      checkRun("completed", "success"),
      checkRun("completed", "skipped"),
    ];
    // When: PR チェックを集約する
    const state = evaluatePrChecks(runs, [], SELF_SUITE);
    // Then: done になる
    expect(state).toBe("done");
  });

  test("[positive] 未完了の check-run があれば pending", () => {
    // Given: 実行中の check-run が存在する
    const runs = [checkRun("in_progress", null), checkRun("completed", "success")];
    // When: PR チェックを集約する
    const state = evaluatePrChecks(runs, [], SELF_SUITE);
    // Then: 待機を続ける
    expect(state).toBe("pending");
  });

  test("[positive] 自身の check-run は check suite id で除外する", () => {
    // Given: 実行中の自身の check-run と、成功した他の check-run
    const runs = [
      checkRun("in_progress", null, SELF_SUITE),
      checkRun("completed", "success", OTHER_SUITE),
    ];
    // When: PR チェックを集約する
    const state = evaluatePrChecks(runs, [], SELF_SUITE);
    // Then: 自身を待たずに done になる
    expect(state).toBe("done");
  });

  test("[positive] pending の commit status は待機の対象にしない", () => {
    // Given: check-run はすべて成功、commit status は pending
    const runs = [checkRun("completed", "success")];
    // When: PR チェックを集約する
    const state = evaluatePrChecks(runs, [status("pending")], SELF_SUITE);
    // Then: done になる（元の集約仕様に一致）
    expect(state).toBe("done");
  });

  test("[negative] 失敗した check-run があれば fail", () => {
    // Given: 失敗で完了した check-run
    const runs = [checkRun("completed", "failure"), checkRun("completed", "success")];
    // When: PR チェックを集約する
    const state = evaluatePrChecks(runs, [], SELF_SUITE);
    // Then: fail になる
    expect(state).toBe("fail");
  });

  test("[negative] cancelled の check-run は失敗として扱う", () => {
    // Given: cancelled で完了した check-run
    const runs = [checkRun("completed", "cancelled")];
    // When: PR チェックを集約する
    const state = evaluatePrChecks(runs, [], SELF_SUITE);
    // Then: fail になる
    expect(state).toBe("fail");
  });

  test("[negative] 失敗した commit status があれば fail", () => {
    // Given: check-run は成功、commit status は failure
    const runs = [checkRun("completed", "success")];
    // When: PR チェックを集約する
    const state = evaluatePrChecks(runs, [status("failure")], SELF_SUITE);
    // Then: fail になる
    expect(state).toBe("fail");
  });
});
