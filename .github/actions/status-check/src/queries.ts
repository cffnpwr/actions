// GitHub API queries backing both the pull request and merge group flows.

import type { Octokit } from "octokit";

import { RequestError } from "octokit";

import type { CheckRun, CommitStatus } from "./checks.ts";
import type { Run } from "./state.ts";
import type { OnValue } from "./triggers.ts";

import { hasMergeGroupTrigger } from "./triggers.ts";

export type Self = { path: string; checkSuiteId: number; };

// This job's own workflow path (to exclude from the merge group expected set)
// and check suite id (to exclude its own check-run in the pull request flow).
export const getSelf = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  runId: number,
): Promise<Self> => {
  const { data } = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId,
  });
  return { path: data.path, checkSuiteId: data.check_suite_id ?? 0 };
};

// The deterministic expected set: every active workflow whose definition at the
// merge commit is triggered by `merge_group`, excluding this job's own workflow.
// merge_group ignores path/branch filters, so this set is exact and independent
// of registration timing.
export const computeExpected = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
  selfPath: string,
): Promise<string[]> => {
  const workflows = await octokit.paginate(
    octokit.rest.actions.listRepoWorkflows,
    { owner, repo, per_page: 100 },
  );
  const expected: string[] = [];
  for (const workflow of workflows) {
    if (workflow.state !== "active" || workflow.path === selfPath) continue;
    let content: string;
    try {
      const res = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: workflow.path,
        ref: headSha,
        mediaType: { format: "raw" },
      });
      content = res.data as unknown as string;
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) continue;
      throw error;
    }
    let doc: { on?: OnValue; } | null;
    try {
      doc = Bun.YAML.parse(content) as { on?: OnValue; } | null;
    } catch {
      continue;
    }
    if (doc && hasMergeGroupTrigger(doc.on)) expected.push(workflow.path);
  }
  return expected;
};

export const listRuns = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
): Promise<Run[]> => {
  const runs = await octokit.paginate(
    octokit.rest.actions.listWorkflowRunsForRepo,
    { owner, repo, event: "merge_group", head_sha: headSha, per_page: 100 },
  );
  return runs.map((run) => ({
    path: run.path,
    status: run.status ?? "",
    conclusion: run.conclusion,
    id: run.id,
  }));
};

export const listPrChecks = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
): Promise<{ checkRuns: CheckRun[]; statuses: CommitStatus[]; }> => {
  const checkRuns = await octokit.paginate(octokit.rest.checks.listForRef, {
    owner,
    repo,
    ref,
    per_page: 100,
  });
  const { data } = await octokit.rest.repos.getCombinedStatusForRef({
    owner,
    repo,
    ref,
  });
  return {
    checkRuns: checkRuns.map((run) => ({
      name: run.name,
      checkSuiteId: run.check_suite?.id ?? null,
      status: run.status,
      conclusion: run.conclusion,
    })),
    statuses: data.statuses.map((status) => ({ state: status.state })),
  };
};
