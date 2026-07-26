# release-npm-package

npmパッケージをリリースするreusable workflowです。

配布物の公開がすべて成功してからGitHub Releaseの下書きを公開します。
これにより、公開に失敗したversionのGitHub Releaseが残りません。

単一パッケージのリポジトリとmonorepoの双方を同じ経路で扱います。

入力パラメーターは持ちません。
可変部分は呼び出し元リポジトリの構造で表現します。

## 呼び出し方

```yaml
# .github/workflows/release-please.yaml
name: Release Please
on:
  push:
    branches:
      - main

concurrency:
  group: release-please-${{ github.repository }}-${{ github.ref }}
  cancel-in-progress: false

permissions: {}

jobs:
  release:
    uses: cffnpwr/actions/.github/workflows/release-npm-package.yaml@<SHA>
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
    secrets: inherit
```

`permissions`には呼ばれた側の各ジョブが必要とする権限の和集合を指定します。
呼ばれた側は各ジョブでこれを縮小して使います。

## 呼び出し元リポジトリの要件

- `.github/release-please/config.json`と`.github/release-please/manifest.json`を置きます
- `config.json`で`"draft": true`を指定します
- miseの設定ファイルで`bun`を宣言します
- ルートで`bun run build`がすべての公開パッケージをビルドします
- npmへ公開するパッケージの`package.json`に`publishConfig.exports`を持たせます
- JSRへ公開するパッケージと同じディレクトリーに`jsr.json`を置きます
- `jsr.json`の`$.version`をrelease-pleaseの`extra-files`で同期します

## 公開先の判定

release-pleaseがリリースを作成したパスごとに、マニフェストの有無で公開先を決めます。

| 条件 | 公開先 |
| --- | --- |
| `package.json`があり`private`が`true`でない | npm |
| `jsr.json`がある | JSR |

## npmのtrusted publishing

npmへの公開はOIDCによるtrusted publishingを前提としています。

npmjs.comのTrusted Publisher設定には公開元のworkflowファイル名を登録します。
reusable workflowを経由する場合、npmが検証するのは**呼び出し元のworkflowファイル名**です。
このworkflowのファイル名ではありません。
呼び出し元のファイル名とTrusted Publisher設定を一致させる必要があります。

`id-token: write`は呼び出し元と呼ばれた側の双方に必要です。

self-hosted runnerはtrusted publishingに対応していません。
そのため、このworkflowはrunnerを指定するパラメーターを持ちません。

参考: [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers)

## JSRの公開

JSRはパッケージとGitHubリポジトリのリンクのみを検証し、workflowファイル名は見ません。
公開するには、jsr.ioのパッケージ設定でリポジトリをリンクします。

参考: [Publishing packages - JSR Docs](https://jsr.io/docs/publishing-packages)

## workspace依存の解決

`bun pm pack`は`workspace:`依存をbun.lockに記録されたversionで置換します。
しかしbun installは、release-pleaseがbumpしたversionをbun.lockへ再同期しません。
そのため、そのまま公開すると公開物のパッケージ間依存が前のversionを指します。

このworkflowは、packの前に`package.json`側で`workspace:`依存を実際のversionへ解決します。
bun.lockは書き換えません。

対応する形式と解決後のrangeは`bun pm pack`と同じです。

| 記述 | 解決後 |
| --- | --- |
| `workspace:*` | `1.2.3` |
| `workspace:^` | `^1.2.3` |
| `workspace:~` | `~1.2.3` |

同一リリースに含まれるパッケージは並行して公開されます。
そのため、依存先がnpmレジストリーに現れるまで待ってから依存元を公開します。

## bun.lockと`package.json`のversionの不一致

リリースPRをマージすると、bun.lockに記録されたworkspaceパッケージのversionが古いまま残ります。
これはbunの既知の不具合です。

参考: [oven-sh/bun#18906](https://github.com/oven-sh/bun/issues/18906)

リリース版のbun 1.3.14と、canaryビルドの1.4.0-canary.1（`ae4b17de6`）で確認した挙動を次に示します。
どちらも結果は同じです。

| 操作 | bun.lockのworkspace version |
| --- | --- |
| `bun install` | 再同期されません |
| `bun install --force` | 再同期されません |
| `bun install --lockfile-only` | 再同期されません |
| `bun update --lockfile-only <名前>` | `DependencyLoop`で失敗します |
| bun.lockを削除して`bun install` | 再同期されますが外部依存も再解決されます |

上記のissueのコメントは、回避策として`bun update --lockfile-only`を挙げています。
しかし、workspaceパッケージ名がnpmにも存在する場合、このコマンドは失敗します。
公開済みのパッケージは常にこの条件に当てはまります。

bun.lockの削除と再生成は、外部依存のversionをリリースPRの中で意図せず更新します。

以上より、このworkflowはbun.lockを同期せず、bunの修正を待ちます。
公開物の内容は`package.json`から解決するため、この不一致の影響を受けません。
`bun install --frozen-lockfile`はversionが古くても成功するため、CIも壊れません。

bunが修正すれば`resolve-workspace-deps`は不要になります。

## 公開物とソースの差分

npmへ公開されるtarballの`package.json`は、タグが指すソースの`package.json`と一致しません。
`publishConfig.exports`の展開と`workspace:`依存の解決を、packの前に適用するためです。

前者は、開発時にソースを参照し、公開物ではビルド成果物を参照させるための差分です。
`bun pm pack`は`publishConfig`を解釈しないため、このworkflowが自前で適用します。

後者は`bun pm pack`が元から行っている置換です。
このworkflowは置換元をbun.lockから`package.json`に変えているだけです。
