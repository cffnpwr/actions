# AGENTS.md

## Project Summary

Shared reusable GitHub Actions workflows for cffnpwr's repositories. The project provides CI workflows (status check, treefmt, actionlint/ghalint/zizmor, semantic PR title) that other repositories call via `workflow_call`. Development tools are managed with mise.

## Critical Rules

- **Security**: All GitHub Actions must pin actions by full SHA (not tags). Use `persist-credentials: false` for checkout steps. Minimize `permissions` to the least required.
- **Formatting**: All files must pass `treefmt` before merge. YAML files use `yamlfmt`.

## Quick Start

```bash
# Install dev tools
mise install

# Format all files
mise exec -- treefmt

# Check formatting without modifying
mise exec -- treefmt --fail-on-change

# Lint GitHub Actions workflows
mise exec -- actionlint -color
mise exec -- ghalint run
```

## Project Structure

```
.github/workflows/           # Reusable GitHub Actions workflows
  status-check.yaml          # PR status check aggregator (workflow_call + pull_request_target)
  treefmt.yaml               # Format check via treefmt (workflow_call + push/PR)
  github-actions-lint.yaml   # actionlint + ghalint + zizmor (workflow_call + push/PR)
  semantic-pr-title.yaml     # Semantic PR title enforcement (workflow_call + pull_request_target)
mise.toml                    # Dev tool versions (mise)
treefmt.toml                 # treefmt configuration
yamlfmt.yaml                 # yamlfmt configuration
renovate.json                # Renovate bot configuration
```

## Development Tools

| Tool | Purpose |
|---|---|
| `treefmt` | Multi-language formatter runner |
| `yamlfmt` | YAML formatter |
| `actionlint` | GitHub Actions workflow linter |
| `ghalint` | GitHub Actions security linter |
| `zizmor` | GitHub Actions security scanner |

## Code Style

- **Indentation**: 2 spaces (all files)
- **Line endings**: LF
- **Charset**: UTF-8
- **Trailing whitespace**: Trimmed
- **Final newline**: Required
- **YAML**: Retain single line breaks, trim trailing whitespace, scan folded as literal
- **Actions pins**: Always use full commit SHA with version comment (e.g., `actions/checkout@<SHA> # v6.0.2`)

## Commit Convention

PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/) format (enforced by `semantic-pr-title.yaml`).
