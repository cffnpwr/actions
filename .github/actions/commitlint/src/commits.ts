// Commit model and author-based partitioning.

import { isIgnoredEmail } from "./authors.ts";

export type Commit = {
  sha: string;
  authorName: string;
  authorEmail: string;
  message: string;
};

// Split commits into those to lint and those excluded by author email.
export const partitionByEmail = (
  commits: Commit[],
  ignoreEmails: string[],
): { toLint: Commit[]; toSkip: Commit[]; } => {
  const toLint: Commit[] = [];
  const toSkip: Commit[] = [];
  for (const commit of commits) {
    if (isIgnoredEmail(commit.authorEmail, ignoreEmails)) {
      toSkip.push(commit);
    } else {
      toLint.push(commit);
    }
  }
  return { toLint, toSkip };
};
