---
status: superseded by ADR-0008
date: 2026-03-16
---

# ADR-0007: check-version-consistency の CLI ライブラリを Typer から Click へ移行

## コンテキスト

ADR-0004にてCLIライブラリとしてTyperを採用した。
Typerは型アノテーションからClickの`Option`を自動生成する設計であり、引数の定義が関数シグネチャに集中する。

現在、プロバイダの追加に対して拡張性の問題がある。
新しいプロバイダを追加するたびに`main.py`の以下の3箇所を変更する必要があり、変更箇所が散在して更新漏れが起きやすい。

1. CLI引数の追加（`--<name>-dir`、`--<name>-bin`など）
2. プロバイダのインスタンス生成コードの追加
3. `check_consistency()`への引数追加

この問題を解決するため、各プロバイダが自身のCLIオプション定義とインスタンス生成ロジックを自己完結して持つ設計を採用したい。
具体的には、`BaseProvider`に以下を追加する。

- `click_options()`クラスメソッド: 自身が必要とする`click.Option`のリストを返す
- `from_options()`クラスメソッド: CLIオプションの値を受け取りインスタンスを生成する

この設計では`click.Option`を直接生成するため、Typerのアノテーションベースの自動変換は不要になる。
Typerはその薄いラッパーとしての役割を失い、依存として残す意義がない。

## 検討した選択肢

### 選択肢 1: Typer を維持したまま`inspect.Signature`で動的生成する

Typerの`@app.command()`に登録する関数のシグネチャを`inspect.Signature`で動的に生成し、Typerにアノテーションを読ませる。

#### 良い点

- Typerの抽象を維持できる
- shell completionなどのTyperの追加機能をそのまま利用できる

#### 悪い点

- `inspect.Signature`の操作は非公開APIに近く、Typerのバージョンアップで壊れるリスクがある
- `typer.Option()`の細かい設定（`exists=True`などのClick機能）が使えない
- Typerが内部でClickに変換する間接層が残るため、デバッグが困難になる

### 選択肢 2: Typer を削除し Click に直接移行する

`BaseProvider.click_options()`が返す`click.Option`のリストを使って`click.Command`を動的に生成する。
`main.py`はプロバイダの登録リスト（`SOURCE_PROVIDERS`）を走査するだけにし、プロバイダ追加時の`main.py`変更をゼロにする。

#### 良い点

- `click.Option`を直接生成するため、`exists=True`などのClick機能をフルに使える
- Typerという間接層がなくなり、コードの挙動が追いやすくなる
- プロバイダ追加時に変更が必要なのは`providers/__init__.py`の登録リストのみになる
- Typerの依存を除去できる（ClickはTyperの依存として間接的に導入されていたが、直接依存になることで意図が明確になる）

#### 悪い点

- Typerが提供していたshell completion機能が失われる（現在`add_completion=False`で無効化しているため実質的な影響はない）
- `typer.echo()`を`click.echo()`に置き換える必要がある（APIはほぼ同等）
- ADR-0004の決定を覆す変更になる

## 決定

選択肢2（Clickへの直接移行）を採用する。

今回の設計変更の本質は、各プロバイダが`click_options()` / `from_options()`を持ち、`click.Option`を直接生成することにある。
その時点でTyperのアノテーション自動変換は不要になる。
Typerを維持しても`inspect.Signature`を介した迂回路が生まれるだけで、Typerを採用した当初の理由（アノテーションによる型安全性と記述量の削減）が成立しなくなる。

また、現在Typerのshell completionは`add_completion=False`で無効化しており、Typer固有の機能を実際には使っていない。
移行コストは`typer.echo()` → `click.echo()`の置き換えと`@app.command()`の除去のみであり、小さい。

本ADRはADR-0004をsupersedeする。

## 結果

### 良い影響

- プロバイダ追加時に`main.py`の変更が不要になり、更新漏れのリスクが下がる
- `click.Option`の全機能（パスの存在検証など）を直接利用できる
- Typerという間接層がなくなり、CLIの動作をClickのドキュメントだけで理解できる

### 悪い影響

- ADR-0004の決定を覆すため、過去の意思決定との整合性が崩れる
  - ADR-0004を`superseded by 0007`に変更して対応
- Clickを直接操作する動的生成のコードは、Typerのアノテーションベースの記述より可読性が低くなりうる
