// Aggregation state derived from a pull request's checks.

import { FAIL_CONCLUSIONS } from "./conclusions.ts";

export type CheckRun = {
  name: string;
  checkSuiteId: number | null;
  status: string;
  conclusion: string | null;
};

export type CommitStatus = { state: string; };

export type CheckState = "done" | "fail" | "pending";

// Mirrors `gh pr checks`: fail on any failing check-run or commit status, stay
// pending while any check-run is not completed, otherwise done. The aggregator's
// own check-run is excluded by its check suite id (naming-independent). Commit
// statuses only affect the fail decision, matching the original PR aggregation.
export const evaluatePrChecks = (
  checkRuns: CheckRun[],
  statuses: CommitStatus[],
  selfCheckSuiteId: number,
): CheckState => {
  const others = checkRuns.filter((run) => run.checkSuiteId !== selfCheckSuiteId);

  const hasFailingRun = others.some(
    (run) => run.status === "completed"
      && run.conclusion !== null
      && FAIL_CONCLUSIONS.has(run.conclusion),
  );
  const hasFailingStatus = statuses.some(
    (status) => status.state === "failure" || status.state === "error",
  );
  if (hasFailingRun || hasFailingStatus) return "fail";

  if (others.some((run) => run.status !== "completed")) return "pending";
  return "done";
};
