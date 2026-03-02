# Version consistency checker

Checks that tool versions in `mise.toml` match those in the Nix devshell (`devShells.default`).

## Usage

```bash
uv run main.py
```

Exits with code `0` if all versions match, `1` if any mismatch is found.

## Requirements

- Python 3.14.3
- `mise` available in `PATH`
- `nix` available in `PATH`

## Output

On success:

```text
All versions match.
```

On mismatch:

```text
MISMATCH: treefmt mise=0.15.0 nix=0.16.0
```

## Development

```bash
# Install dev dependencies
uv sync

# Lint
uv run ruff check .

# Format
uv run ruff format .
```
