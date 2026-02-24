# AGENTS.md

## Project Summary

Shared reusable GitHub Actions workflows for cffnpwr's repositories. The project provides CI workflows (status check, treefmt, actionlint/ghalint/zizmor, semantic PR title, nix flake check) that other repositories call via `workflow_call`. Development environment is managed with Nix flakes.

## Critical Rules

- **Security**: All GitHub Actions must pin actions by full SHA (not tags). Use `persist-credentials: false` for checkout steps. Minimize `permissions` to the least required.
- **Formatting**: All files must pass `treefmt` before merge. Nix files use `nixfmt`, YAML files use `yamlfmt`.

## Quick Start

```bash
# Enter dev environment
nix develop

# Format all files
treefmt

# Check formatting without modifying
treefmt --fail-on-change

# Check Nix flake
nix flake check --all-systems

# Lint GitHub Actions workflows
actionlint -color
ghalint run
```

## Project Structure

```
.github/workflows/           # Reusable GitHub Actions workflows
  status-check.yaml          # PR status check aggregator (workflow_call + pull_request_target)
  treefmt.yaml               # Format check via treefmt (workflow_call + push/PR)
  github-actions-lint.yaml   # actionlint + ghalint + zizmor (workflow_call + push/PR)
  semantic-pr-title.yaml     # Semantic PR title enforcement (workflow_call + pull_request_target)
  flake-check.yaml           # Nix flake check (workflow_call + push/PR)
flake.nix                    # Nix flake for dev environment
treefmt.toml                 # treefmt configuration
yamlfmt.yaml                 # yamlfmt configuration
renovate.json                # Renovate bot configuration
```

## Development Tools

| Tool | Purpose |
|---|---|
| `treefmt` | Multi-language formatter runner |
| `nixfmt` | Nix code formatter |
| `yamlfmt` | YAML formatter |
| `actionlint` | GitHub Actions workflow linter |
| `ghalint` | GitHub Actions security linter |
| `zizmor` | GitHub Actions security scanner |
| `nil` / `nixd` | Nix LSP servers |

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
