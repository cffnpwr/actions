# Code Style and Conventions

## General (all files, via .editorconfig)
- Indent: 2 spaces
- Line endings: LF
- Charset: UTF-8
- Trailing whitespace: trimmed
- Final newline: required

## Nix Files
- Formatter: `nixfmt`
- Configured in `treefmt.toml` and `flake.nix` (`formatter = pkgs.nixfmt`)

## YAML Files
- Formatter: `yamlfmt`
- Settings (`yamlfmt.yaml`):
  - `retain_line_breaks_single: true`
  - `scan_folded_as_literal: true`
  - `trim_trailing_whitespace: true`
  - `eof_newline: true`
  - `line_ending: lf`

## GitHub Actions Workflows
- Pin actions by **full commit SHA** with version comment: `uses: actions/checkout@<SHA> # v6.0.2`
- Use `persist-credentials: false` on all checkout steps
- Set `permissions: {}` at workflow top level, grant minimum per-job
- Use `concurrency` groups with `cancel-in-progress: true`
- Runner: `ubuntu-24.04`
- Set explicit `timeout-minutes` for all jobs

## Commit Convention
- PR titles must follow Conventional Commits format
- Enforced by `semantic-pr-title.yaml`


