# version-consistency-checker

[![GitHub License](https://img.shields.io/github/license/cffnpwr/actions?style=flat)](../../LICENSE)

Nix flakeのdevShellパッケージと他のバージョン管理ソース（miseなど）のバージョン一貫性をチェックするCLIツールです。

[README.md for English is available here](./README.md)

## 使い方

```bash
version-consistency-checker [options]
```

### オプション

| フラグ                   | 説明                                              | デフォルト |
| ------------------------ | ------------------------------------------------- | ---------- |
| `-h, --help`             | ヘルプメッセージを表示する                        |            |
| `--flake-dir <string>`   | `flake.nix` を含むディレクトリのパス              | `.`        |
| `--nix-bin <string>`     | `nix` バイナリのパス（デフォルト: PATHから解決）  |            |
| `--project-dir <string>` | `mise.toml` を含むプロジェクトディレクトリのパス  | `.`        |
| `--mise-bin <string>`    | `mise` バイナリのパス（デフォルト: PATHから解決） |            |

### 例

```bash
# カレントディレクトリでバージョン一貫性をチェック
version-consistency-checker

# パスを明示的に指定する
version-consistency-checker --flake-dir /path/to/project --project-dir /path/to/project
```

## ライセンス

[MIT License](../../LICENSE)
