---
status: superseded by ADR-0008
date: 2026-03-02
---

# ADR-0003: check-version-consistency の実装言語選択

## コンテキスト

ADR-0002にて、check-version-consistencyを専用プログラムとして実装することを決定した。
本ADRではその実装言語を決定する。

前提として、以下が確定している。

- miseのバージョン情報は`mise ls --local --json`の外部コマンド呼び出しで取得する
- Nix devshellのパッケージバージョンは`nix eval`の外部コマンド呼び出しで取得する
- **どの言語を選んでも外部コマンド呼び出しは避けられない**（mise内部APIは使用不可）

Rustも候補として検討したが、以下の理由で早期に除外した。

- JSONパースに`serde_json`（`serde`を含む）という外部依存が必須
- mise内部APIが使えない（binary crateのみのため）以上、Rust固有の優位性がなく、外部依存のコストだけが残る

## 検討した選択肢

### 選択肢1: Go

外部コマンド呼び出しとJSONパースをstdlibのみで実装できるコンパイル言語。

#### 良い点

- `encoding/json`、`os/exec`がstdlibに含まれるため外部依存なしで実装できる
- 静的型付けによりバグを早期に発見できる
- `go test`による標準的なテストが書ける
- `buildGoModule`でNixパッケージとして`nix run`で実行できる

#### 悪い点

- `go.mod`、`go.sum`、Go toolchainが必要で、このリポジトリ（現在YAML + Nixのみ）に新たな言語スタックが追加される
- `flake.nix`に`buildGoModule`とdevShellへのGo追加が必要
- `treefmt.toml`に`gofmt`の追加が必要
- Binary cacheなしだとCIでのビルドに時間がかかる

### 選択肢2: Python

外部コマンド呼び出しとJSONパースをstdlibのみで実装できるインタープリタ言語。

#### 良い点

- `subprocess`、`json`がstdlibに含まれるため外部依存なしで実装できる
- `python3`はubuntu-24.04・macos-15のGitHub Actions runnerにデフォルト搭載されており追加インストール不要
- ビルドステップが不要でCIをシンプルに保てる
- `unittest`（stdlib）または`pytest`（`nix-shell -p python3Packages.pytest`）でテストが書ける

#### 悪い点

- 動的型付けのため型エラーが実行時まで発覚しない
- バイナリとして配布できないため`nix run`での実行には`writeShellApplication` + `python3`の組み合わせが必要
- `flake.nix`に`python3`とdevShellへの追加が必要
- `treefmt.toml`にPython formatter（`ruff`など）の追加が必要

## 決定

Pythonを採用する。

どちらの言語でもstdlibのみで実装可能、かつ`flake.nix`と`treefmt.toml`の変更が必要という点は同等であり、技術的な優劣は明確につけられない。
uvおよびruffを使用する前提では、RenovateによるPR発生コストもGoと同等となる。
最終的な決め手は、coding agentとの相性においてPythonが若干勝ると判断したことである。

## 結果

### 良い影響

- `subprocess`、`json`がstdlibに含まれるため外部依存なしで実装できる
- `python3`はubuntu-24.04・macos-15のGitHub Actions runnerにデフォルト搭載されており追加インストール不要
- ビルドステップが不要でCIをシンプルに保てる
- `unittest`（stdlib）または`pytest`でテストが書ける

### 悪い影響

- 動的型付けのため型エラーが実行時まで発覚しない
- バイナリとして配布できないため`nix run`での実行には`writeShellApplication` + `python3`の組み合わせが必要
- `flake.nix`に`python3`とdevShellへの追加が必要
- `treefmt.toml`に`ruff`の設定追加が必要
