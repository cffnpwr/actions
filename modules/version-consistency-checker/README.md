# version-consistency-checker

[![GitHub License](https://img.shields.io/github/license/cffnpwr/actions?style=flat)](../../LICENSE)

A CLI tool that checks version consistency between Nix flake devShell packages and other version sources (e.g. mise).

[日本語のREADMEはこちら](./README-ja.md)

## How to Use

```bash
version-consistency-checker [options]
```

### Options

| Flag                     | Description                                             | Default |
| ------------------------ | ------------------------------------------------------- | ------- |
| `-h, --help`             | Show help message                                       |         |
| `--flake-dir <string>`   | Path to the directory containing `flake.nix`            | `.`     |
| `--nix-bin <string>`     | Path to the `nix` binary (default: resolved from PATH)  |         |
| `--project-dir <string>` | Path to the project directory containing `mise.toml`    | `.`     |
| `--mise-bin <string>`    | Path to the `mise` binary (default: resolved from PATH) |         |

### Example

```bash
# Check version consistency in the current directory
version-consistency-checker

# Specify custom paths
version-consistency-checker --flake-dir /path/to/project --project-dir /path/to/project
```

## License

[MIT License](../../LICENSE)
