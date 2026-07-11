// Workflow run / check-run conclusions grouped by outcome.

export const FAIL_CONCLUSIONS = new Set([
  "failure",
  "cancelled",
  "timed_out",
  "startup_failure",
  "action_required",
]);

export const PASS_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);
