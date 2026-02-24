# Project Overview: cffnpwr/actions

## Purpose
Shared reusable GitHub Actions workflows for cffnpwr's repositories.
Other repositories call these workflows via `workflow_call`.

## Tech Stack
- **GitHub Actions** (YAML workflow definitions)
- **Nix Flakes** (development environment management)

## Workflows
| File | Purpose | Triggers |
|---|---|---|
| `status-check.yaml` | PR status check aggregator | `pull_request_target`, `workflow_call` |
| `treefmt.yaml` | Format check via treefmt | `push`, `pull_request`, `workflow_call` (implicit) |
| `github-actions-lint.yaml` | actionlint + ghalint + zizmor | `push`, `pull_request`, `workflow_call` |
| `semantic-pr-title.yaml` | Conventional Commits PR title enforcement | `pull_request_target`, `workflow_call` |
| `flake-check.yaml` | Nix flake check | `push`, `pull_request`, `workflow_call` |

## Project Structure
```
.github/workflows/     # All reusable workflow files
flake.nix              # Nix flake (dev environment, formatter)
treefmt.toml           # treefmt config (nixfmt for *.nix, yamlfmt for *.yaml)
yamlfmt.yaml           # yamlfmt settings
renovate.json          # Renovate bot config (extends cffnpwr/renovate-config)
.editorconfig          # Editor settings (2-space indent, LF, UTF-8)
```

## Key Architectural Decisions
- All workflows use `permissions: {}` at top level, granting minimum permissions per job
- Actions are pinned by full commit SHA with version comment (e.g., `@<SHA> # v6.0.2`)
- Checkout steps use `persist-credentials: false` for security
- Runner: `ubuntu-24.04` for all jobs
- Concurrency groups cancel in-progress runs
