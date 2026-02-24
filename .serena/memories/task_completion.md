# Task Completion Checklist

## Before Considering a Task Complete

1. **Formatting**: Run `treefmt` (or `treefmt --fail-on-change` to verify)
   - Nix files formatted with `nixfmt`
   - YAML files formatted with `yamlfmt`

2. **Linting** (if workflow files were modified):
   - Run `actionlint -color`
   - Run `ghalint run`

3. **Nix** (if `flake.nix` or `*.nix` modified):
   - Run `nix flake check --all-systems`

4. **Security checks** (if workflow files were modified):
   - Actions pinned by full SHA with version comment
   - `persist-credentials: false` on checkout steps
   - Minimal `permissions` set

## Do NOT Do Unless Explicitly Asked
- Do not run formatters or linters proactively
- Only perform the explicitly requested task
