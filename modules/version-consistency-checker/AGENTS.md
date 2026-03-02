# AGENTS.md

## Project Summary

A CLI tool that checks version consistency between the Nix devshell (`flake.nix`) and `mise.toml`. Written in Python using Typer and Pydantic. Exits with code `0` if all versions match, `1` if any mismatch is found.

## Critical Rules

- **Python version**: Must use Python 3.14.3 (enforced by `.python-version`)
- **Formatting**: All Python files must pass `ruff format` before merge
- **Linting**: All Python files must pass `ruff check` before merge
- **Indentation**: 2 spaces (configured in `ruff.toml`)
- **No new files without request**: Never create files the user did not explicitly request

## Quick Start

```bash
# Install dev dependencies
uv sync

# Run the tool
uv run vcc --flake-dir /path/to/flake --project-dir /path/to/project

# Run tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=version_consistency_checker

# Lint
uv run ruff check .

# Format
uv run ruff format .

# Type check
uv run ty check
```

## Project Structure

```
src/version_consistency_checker/
  __init__.py          # Entrypoint: exposes main()
  main.py              # CLI definition (Typer app)
  checker.py           # Core consistency check logic
  providers/
    base.py            # Abstract BaseProvider
    nix.py             # Fetches tool versions from flake.nix devshell
    mise.py            # Fetches tool versions from mise.toml
  models/
    nix.py             # Pydantic models for Nix flake output
    mise.py            # Pydantic models for mise.toml
  utils/
    normalize_tool_name.py  # Normalizes tool names for comparison
    resolve_bin.py          # Resolves binary paths

tests/                 # Mirrors src/ structure
```

## Architecture

- **Provider pattern**: `BaseProvider` defines `fetch_tool_versions() -> dict[str, str]`. Each provider (`NixProvider`, `MiseProvider`) implements this interface.
- **Checker**: `check_consistency(nix_versions, **sources)` compares Nix versions against one or more sources. Tool names are normalized before comparison.
- **Mismatch model**: `Mismatch(tool, nix_version, mismatched_sources)` represents a detected inconsistency.

## Adding a New Provider

1. Create `src/version_consistency_checker/providers/<name>.py`
2. Implement `BaseProvider` with `fetch_tool_versions() -> dict[str, str]`
3. Add the provider to `main.py` and pass its result to `check_consistency()`
4. Add tests under `tests/version_consistency_checker/providers/test_<name>.py`

## Code Style

- **Indentation**: 2 spaces
- **Line endings**: LF
- **Quote style**: Double quotes
- **Line length**: 88 characters
- **Type annotations**: Required on all functions (`ANN` rules enforced)
- **Ruff rules**: E, W, F, I, B, UP, RUF, SIM, C4, PTH, S, ANN, EM, FBT, ERA, FIX, TD

## Commit Convention

PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/) format.
