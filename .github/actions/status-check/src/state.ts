// Aggregation state derived from the merge group's workflow runs.

import { FAIL_CONCLUSIONS, PASS_CONCLUSIONS } from "./conclusions.ts";

export type Run = {
  path: string;
  status: string;
  conclusion: string | null;
  id: number;
};

export type State = "done" | "fail" | "pending";

// Fail wins over pending: a single completed-failing expected workflow fails
// the job even if others are still pending. "done" requires every expected
// workflow to have a completed run with a passing conclusion. The job's own run
// (selfPath) is ignored so it never waits on itself.
export const evaluateState = (
  expected: string[],
  runs: Run[],
  selfPath: string,
): State => {
  const latest = new Map<string, Run>();
  for (const run of runs) {
    if (run.path === selfPath) continue;
    const prev = latest.get(run.path);
    if (!prev || run.id > prev.id) latest.set(run.path, run);
  }

  let pending = false;
  for (const path of expected) {
    const run = latest.get(path);
    if (run?.status !== "completed") {
      pending = true;
      continue;
    }
    if (run.conclusion && FAIL_CONCLUSIONS.has(run.conclusion)) return "fail";
    if (!(run.conclusion && PASS_CONCLUSIONS.has(run.conclusion))) pending = true;
  }
  return pending ? "pending" : "done";
};
