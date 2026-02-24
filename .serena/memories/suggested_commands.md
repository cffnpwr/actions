# Suggested Commands

## Development Environment
```bash
nix develop                          # Enter dev shell with all tools
```

## Formatting
```bash
treefmt                              # Format all files (nixfmt + yamlfmt)
treefmt --fail-on-change             # Check formatting without modifying
nixfmt <file.nix>                    # Format a single Nix file
yamlfmt <file.yaml>                  # Format a single YAML file
```

## Linting
```bash
actionlint -color                    # Lint GitHub Actions workflows
ghalint run                          # Security lint for GitHub Actions
```

## Nix
```bash
nix flake check --all-systems        # Check Nix flake validity
nix fmt                              # Format using flake formatter (nixfmt)
```

## System Utilities (macOS / Darwin)
```bash
ls, find, grep                       # Standard Unix utilities (BSD variants on macOS)
```
