// Reading the commits in a range via libgit2 (es-git), without shelling out to
// the git CLI.

import { openRepository, RevwalkSort } from "es-git";

import type { Commit } from "./commits.ts";

// List the commits in `from..to` (oldest first) with the fields commitlint
// needs. `from` is excluded and `to` is included, matching `git log from..to`.
export const readCommits = async (
  repoPath: string,
  from: string,
  to: string,
): Promise<Commit[]> => {
  const repo = await openRepository(repoPath);
  const walk = repo.revwalk();
  walk.pushRange(`${from}..${to}`);
  walk.setSorting(RevwalkSort.Reverse);

  const commits: Commit[] = [];
  for (let oid = walk.next(); oid !== null; oid = walk.next()) {
    const commit = repo.getCommit(oid);
    const author = commit.author();
    commits.push({
      sha: oid,
      authorName: author.name,
      authorEmail: author.email,
      message: commit.message(),
    });
  }
  return commits;
};
