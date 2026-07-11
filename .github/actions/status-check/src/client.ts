// GitHub API client backed by octokit.

import { Octokit } from "octokit";

export const createOctokit = (apiUrl: string, token: string): Octokit => new Octokit({ auth: token, baseUrl: apiUrl });
