---
status: accepted
date: 2026-03-18
---

# ADR-0008: check-version-consistencyの実装言語をPythonからTypeScriptへ移行

## コンテキスト

ADR-0003にてcheck-version-consistencyの実装言語としてPythonを採用した。
決め手は「coding agentとの相性においてPythonが若干勝る」という判断であった。

その後の実装作業において、Python固有の型システムの限界が顕在化した。

具体的には、CLIオプションのメタデータを表す`RequiredOption[T]`/`OptionalOption[T]`を`dataclass`で設計した際に、以下の問題が生じた。

- Pythonのジェネリクス型パラメータ（`T`）は実行時に消えるため、`opt.type`の値を型パラメータとは別にフィールドとして持つ必要があり、型情報と実行時の値の二重管理が生じる
- `type[BaseProvider]`から各プロバイダ固有の`new()`を呼ぶ際、シグネチャがプロバイダごとに異なり`BaseProvider`へ抽象化できないため、`# type: ignore`が必要になる
- `returns`ライブラリの`Result`型はPythonの型システムとの親和性が低く、テストコードとの乖離が発生している

これらの問題はいずれも「Pythonの動的型付けに静的型システムを後付けしている」ことに起因する。
ADR-0003が悪い影響として挙げた「動的型付けのため型エラーが実行時まで発覚しない」という本質的な問題が、実装規模の拡大とともに表面化した形である。

TypeScriptは本ツールが必要とする型表現を言語レベルで備えている。

- discriminated unionによる`RequiredOption`/`OptionalOption`の判別が型安全に記述できる
- ジェネリクスは実行時にも型情報を利用するパターンが確立されている
- `neverthrow`等のResult型ライブラリとの型システムの親和性が高い
- `tsx`で実行でき、ビルドステップを省略できる
- GitHub Actionsのrunner（ubuntu-24.04・macos-15）にNode.jsがデフォルト搭載されている

## 検討した選択肢

### 選択肢1: Pythonを維持し型システムの制約を受け入れる

`type: ignore`コメントと実行時の型情報の二重管理を許容してPythonで実装を継続する。

#### 良い点

- 既存のコードベース・テスト・ツール設定を維持できる
- 移行コストが発生しない

#### 悪い点

- ジェネリクスと実行時値の二重管理が残り続け、設計の意図が型システムで表現できない
- `# type: ignore`が増加し、型チェッカーの恩恵が部分的にしか受けられない
- プロバイダ追加時の型安全性が保証されない

### 選択肢2: TypeScriptへ移行する

実装言語をTypeScriptに変更し、型システムの表現力を活かした設計をする。

#### 良い点

- discriminated unionで`RequiredOption`/`OptionalOption`を型安全に判別できる
- ジェネリクスが実行時に消えないため、型パラメータと値の二重管理が不要になる
- `neverthrow`等によるResult型が型システムと自然に統合できる
- `commander`等のCLIライブラリで動的なオプション登録を型安全に記述できる
- `tsx`により実行時にコンパイル不要でスクリプトとして動作する
- GitHub Actions runnerにNode.jsがデフォルト搭載されており追加インストール不要

#### 悪い点

- 既存のPythonコード・テスト・ツール設定（`pyproject.toml`・`ruff`・`pytest`等）をすべて破棄して書き直す必要がある
- `flake.nix`・`treefmt.toml`のPython関連設定をNode.js関連設定に置き換える必要がある
- ADR-0003・0004・0005・0006・0007の決定を覆す

## 決定

選択肢2（TypeScriptへの移行）を採用する。

今回の設計作業で明らかになった問題は表面的な実装の詳細ではなく、Pythonの型システムの構造的な限界に起因する。
`type: ignore`で回避し続けることは型チェッカーの恩恵を損ない、プロバイダ追加時の安全性を低下させる。

TypeScriptのジェネリクスとdiscriminated unionは、本ツールが必要とする「型安全なプロバイダ登録・CLIオプション動的生成」の設計を言語レベルで表現できる。
また、GitHub ActionsのrunnerにNode.jsがデフォルト搭載されている点で、実行環境の前提条件はPythonと同等である。

本ADRはADR-0003を、また実装言語に依存するADR-0004・0005・0006・0007をあわせてsupersedeする。

## 結果

### 良い影響

- ジェネリクスとdiscriminated unionにより、プロバイダのCLIオプション定義が型安全に記述できる
- Result型が型システムと自然に統合でき、エラーハンドリングの漏れを型チェッカーが検出できる
- プロバイダ追加時の変更箇所が型によって保証され、更新漏れのリスクが下がる

### 悪い影響

- 既存のPython実装・テスト・ツール設定をすべて書き直す必要がある
- ADR-0003〜0007の決定を覆すため、過去の意思決定との整合性が崩れる
