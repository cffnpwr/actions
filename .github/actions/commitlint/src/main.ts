// Run commitlint over a commit range, skipping commits authored by ignored
// emails (e.g. renovate[bot], whose generated messages may violate the rules).
//
// commitlint's own `ignores` hook only sees the message, not the author, so the
// author-based exclusion happens here: read the range via libgit2, drop matching
// authors, then lint each remaining commit's message.

import { resolve } from "node:path";

import { parseIgnoreEmails } from "./authors.ts";
import { loadConfig, runCommitlint } from "./commitlint.ts";
import { partitionByEmail } from "./commits.ts";
import { readCommits } from "./git.ts";

type Env = {
  repoPath: string;
  from: string;
  to: string;
  ignoreEmails: string;
  configFile: string | undefined;
};

const readEnv = (): Env => {
  const need = (key: string): string => {
    const value = process.env[key];
    if (!value) throw new Error(`missing environment variable ${key}`);
    return value;
  };
  return {
    repoPath: need("REPO_PATH"),
    from: need("FROM_SHA"),
    to: need("TO_SHA"),
    ignoreEmails: process.env.IGNORE_EMAILS ?? "",
    configFile: process.env.CONFIG_FILE || undefined,
  };
};

const main = async (): Promise<void> => {
  const env = readEnv();
  const commits = await readCommits(env.repoPath, env.from, env.to);
  const ignoreEmails = parseIgnoreEmails(env.ignoreEmails);
  const { toLint, toSkip } = partitionByEmail(commits, ignoreEmails);

  for (const commit of toSkip) {
    console.log(
      `::notice::Skipping ${commit.sha} (author: ${commit.authorName} <${commit.authorEmail}>)`,
    );
  }

  if (toLint.length === 0) return;

  const configFile = env.configFile ? resolve(env.repoPath, env.configFile) : undefined;
  const config = await loadConfig(env.repoPath, configFile);
  let failed = false;
  for (const commit of toLint) {
    const { valid, report } = await runCommitlint(commit.message, config);
    const author = `${commit.authorName} <${commit.authorEmail}>`;
    if (valid) {
      console.log(`✔ ${commit.sha} (${author})`);
      continue;
    }
    failed = true;
    console.log(`::error::${commit.sha} (${author}) failed commitlint`);
    console.log(`✖ ${commit.sha} (${author})`);
    console.log(`  ${commit.message.split("\n")[0]}`);
    for (const line of report.split("\n")) console.log(`  ${line}`);
  }

  if (failed) process.exit(1);
};

if (import.meta.main) {
  await main();
}
