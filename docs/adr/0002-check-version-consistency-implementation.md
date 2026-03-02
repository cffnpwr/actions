---
status: accepted
date: 2026-03-02
---

# ADR-0002: check-version-consistency の実装方針

## コンテキスト

`mise.toml`とNix devshellのツールバージョンの整合性チェックを行うreusable workflowを追加する。
チェックロジックをどのように実装するかを決定する必要がある。

チェックする内容は以下の通り。

- `mise.toml`の`[tools]`セクションに記載された各ツールのバージョン
- Nix devshell（`devShells.default`）の`buildInputs`および`nativeBuildInputs`に含まれるパッケージのバージョン

なお、以下の制約が調査により判明している。

- miseはRust製のbinary crateであり`lib.rs`を持たないため、Rustライブラリとして依存できない。
  HTTP API / IPCも存在しない。したがって、**miseのバージョン情報取得は
  `mise ls --local --json`の外部コマンド呼び出しに頼るしかない**
- Nix devshellのパッケージバージョン取得は`nix eval`の外部コマンド呼び出しで行う。NixのRust/Goライブラリは実験的かつ不安定なため採用しない
- `mkShell`では`packages = [...]`引数は`nativeBuildInputs`に格納される（`buildInputs`ではない）。そのため両方をマージして参照する必要がある

## 検討した選択肢

### 選択肢1: シェルスクリプトをワークフロー YAML にインライン記述

`run:`ブロックに直接シェルスクリプトを書き、`grep`/`awk`で`mise.toml`をパースする。

#### 良い点

- 追加ファイル不要でワークフローが自己完結する
- 依存関係がない

#### 悪い点

- `grep`/`awk`によるTOMLパースは`[tools]`セクション以外の行にも誤ってマッチするリスクがある
- `sed`/`jq`のパイプラインで可読性が低い
- テストが困難

### 選択肢2: 専用プログラムをファイルとして分離

チェックロジックをスクリプトまたはプログラムとして独立したファイルに切り出し、ワークフローから呼び出す。
`mise ls --local --json`でmise側のバージョンを取得することでTOMLパースをmiseに委譲できる。

#### 良い点

- テストが書ける
- TOMLパースをmiseに委譲できる（`[tools]`セクションの正確な取得）
- ロジックが可読・保守しやすい

#### 悪い点

- 追加ファイルが必要
- reusable workflowから同じリポジトリのファイルを参照するため、ワークフロー内で
  `cffnpwr/actions`を追加checkoutするステップが必要

## 決定

選択肢2（専用プログラムをファイルとして分離）を採用する。

複数の外部依存（mise、nix）とバージョンマッチングロジックが絡む複雑さを持つため、
テストを含む独立したプログラムとして実装することが長期的な保守性に優れる。
実装言語は別途決定する。

## 結果

### 良い影響

- ロジックのテストが可能になる
- TOMLパースの正確性が担保される（miseに委譲）
- ワークフロー YAMLがシンプルに保てる

### 悪い影響

- reusable workflow内で`cffnpwr/actions`の追加checkoutが必要になる
- このリポジトリにプログラムファイルが追加される
