// Wait for a commit's checks to complete, for both pull request and merge group
// runs.
//
// Pull request: watch the check-runs and commit statuses on the PR head, like
// `gh pr checks` (see checks.ts).
//
// Merge group: a merge_group run carries no PR number, so the expected set of
// workflows is derived from configuration (see queries.ts) and the job waits
// until each has a completed run. This makes a vacuous early pass impossible: an
// expected-but-unregistered workflow keeps the job pending, and any failing
// expected workflow fails the job.

import type { Octokit } from "octokit";

import { evaluatePrChecks } from "./checks.ts";
import { createOctokit } from "./client.ts";
import { computeExpected, getSelf, listPrChecks, listRuns } from "./queries.ts";
import { evaluateState } from "./state.ts";

type Env = {
  token: string;
  owner: string;
  repo: string;
  apiUrl: string;
  eventName: string;
  runId: number;
  headSha: string;
  pendingInterval: number;
  errorInterval: number;
};

const readEnv = (): Env => {
  const need = (key: string): string => {
    const value = process.env[key];
    if (!value) throw new Error(`missing environment variable ${key}`);
    return value;
  };
  const [owner, repo] = need("GITHUB_REPOSITORY").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY must be in owner/repo form");
  }
  return {
    token: need("GITHUB_TOKEN"),
    owner,
    repo,
    apiUrl: process.env.GITHUB_API_URL || "https://api.github.com",
    eventName: need("GITHUB_EVENT_NAME"),
    runId: Number(need("GITHUB_RUN_ID")),
    headSha: need("HEAD_SHA"),
    pendingInterval: Number(process.env.PENDING_INTERVAL || "15"),
    errorInterval: Number(process.env.ERROR_INTERVAL || "30"),
  };
};

const withRetry = async <T>(
  label: string,
  errorInterval: number,
  fn: () => Promise<T>,
): Promise<T> => {
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      console.error(`${label} failed: ${error}; retrying in ${errorInterval}s`);
      await Bun.sleep(errorInterval * 1000);
    }
  }
};

const watchPullRequest = async (
  octokit: Octokit,
  env: Env,
  selfCheckSuiteId: number,
): Promise<void> => {
  for (;;) {
    const { checkRuns, statuses } = await withRetry("list PR checks", env.errorInterval, () => listPrChecks(octokit, env.owner, env.repo, env.headSha));
    const state = evaluatePrChecks(checkRuns, statuses, selfCheckSuiteId);
    console.log(`state=${state} | checks=${checkRuns.length} statuses=${statuses.length}`);
    if (state === "fail") process.exit(1);
    if (state === "done") return;
    await Bun.sleep(env.pendingInterval * 1000);
  }
};

const watchMergeGroup = async (
  octokit: Octokit,
  env: Env,
  selfPath: string,
): Promise<void> => {
  const expected = await withRetry("compute expected set", env.errorInterval, () => computeExpected(octokit, env.owner, env.repo, env.headSha, selfPath));
  console.log(
    `expected merge_group workflows (${expected.length}): ${JSON.stringify(expected)}`,
  );
  if (expected.length === 0) {
    console.error(
      "no merge_group-triggered workflow found besides this one; refusing to pass without any check to aggregate",
    );
    process.exit(1);
  }
  for (;;) {
    const runs = await withRetry("list workflow runs", env.errorInterval, () => listRuns(octokit, env.owner, env.repo, env.headSha));
    const state = evaluateState(expected, runs, selfPath);
    console.log(`state=${state}`);
    if (state === "fail") process.exit(1);
    if (state === "done") return;
    await Bun.sleep(env.pendingInterval * 1000);
  }
};

const main = async (): Promise<void> => {
  const env = readEnv();
  const octokit = createOctokit(env.apiUrl, env.token);
  const self = await withRetry("resolve self workflow", env.errorInterval, () => getSelf(octokit, env.owner, env.repo, env.runId));
  console.log(`self workflow: ${self.path} (event: ${env.eventName})`);

  if (env.eventName === "merge_group") {
    await watchMergeGroup(octokit, env, self.path);
  } else {
    await watchPullRequest(octokit, env, self.checkSuiteId);
  }
};

if (import.meta.main) {
  await main();
}
