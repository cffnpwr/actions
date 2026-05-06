import type { UserConfig } from "@commitlint/types";

const ALLOWED_GITMOJI = [
  ":art:",
  ":zap:",
  ":fire:",
  ":bug:",
  ":ambulance:",
  ":sparkles:",
  ":memo:",
  ":tada:",
  ":white_check_mark:",
  ":lock:",
  ":green_heart:",
  ":wrench:",
  ":package:",
] as const;

const ALLOWED_TYPES = [
  "feat",
  "fix",
  "chore",
  "docs",
  "refactor",
  "test",
  "build",
  "ci",
  "perf",
  "style",
  "revert",
] as const;

const config: UserConfig = {
  rules: {
    "type-enum": [2, "always", [...ALLOWED_TYPES]],
    "type-empty": [2, "never"],
    "type-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-max-length": [2, "always", 72],
    "body-empty": [2, "always"],
    "footer-empty": [2, "always"],
    "gitmoji-whitelist": [2, "always"],
  },
  plugins: [
    {
      rules: {
        "gitmoji-whitelist": ({ subject }) => {
          if (!subject) return [true];
          const match = subject.match(/^(:[a-z0-9_+-]+:)\s/);
          if (!match) return [true];
          if ((ALLOWED_GITMOJI as readonly string[]).includes(match[1])) {
            return [true];
          }
          return [
            false,
            `gitmoji ${match[1]} is not in the whitelist: ${ALLOWED_GITMOJI.join(", ")}`,
          ];
        },
      },
    },
  ],
};

export default config;
