---
status: accepted
date: 2026-03-18
---

# ADR-0009: check-version-consistencyのJavaScriptランタイム選択

## コンテキスト

ADR-0008にてcheck-version-consistencyの実装言語をTypeScriptへ移行することを決定した。
TypeScriptを直接実行するランタイムとして、Node.js・Deno・Bunの3つを検討する。

実行環境はNixで用意するため、GitHub Actions runnerへのデフォルト搭載有無は考慮しない。

## 検討した選択肢

### 選択肢1: Node.js（`tsx`で直接実行）

Node.js上でTypeScriptを直接実行するには`tsx`や`ts-node`等のトランスパイラが必要である。
パッケージマネージャは`npm`・`pnpm`・`yarn`・`bun`から選択する必要がある。

#### 良い点

- エコシステムが最も成熟しており、npmパッケージの互換性が最大である
- `devDependencies`・`optionalDependencies`等の依存関係の分類が`package.json`でサポートされている
- `treefmt`への統合実績が豊富である

#### 悪い点

- TypeScriptを直接実行するために`tsx`等の追加ツールが必要になる
- パッケージマネージャの選択コストが発生する（`npm`・`pnpm`・`yarn`・`bun`）
- 起動速度が3つの選択肢の中で最も遅い

### 選択肢2: Deno

TypeScriptをネイティブに実行でき、`deno run`のみで動作する。

#### 良い点

- TypeScriptをネイティブにサポートしており、追加ツールなしで実行できる
- セキュリティモデル（パーミッション制御）が組み込まれている
- `deno.json`で設定を一元管理できる

#### 悪い点

- `devDependencies`に相当する機能がない。
  npmパッケージの`package.json`を読む場合でも`devDependencies`のインストール制御が未実装であり、2025年時点でopenのissueとして残っている
- Node.jsとの互換性を持たないnpmパッケージでは動作しない場合がある

### 選択肢3: Bun

TypeScriptをネイティブに実行でき、パッケージマネージャも内蔵している。

#### 良い点

- TypeScriptをネイティブにサポートしており、追加ツールなしで実行できる
- パッケージマネージャが内蔵されているため、Node.jsで発生するパッケージマネージャの選択コストがない
- `devDependencies`・`optionalDependencies`等の依存関係の分類を`package.json`でサポートしている
- インストール速度・起動速度が3つの選択肢の中で最も速い
- Node.jsとの高い互換性を持つ

#### 悪い点

- Node.jsと比較してエコシステムの歴史が浅い
- Node.jsと完全な互換性があるわけではなく、一部のnpmパッケージで動作しない場合がある

## 決定

選択肢3（Bun）を採用する。

TypeScriptのネイティブ実行・パッケージマネージャの内蔵・`devDependencies`のサポートという3点が揃っている。
Node.jsで発生するパッケージマネージャの選択コストとDeno固有の依存関係管理の制約をいずれも回避できる。

Node.jsとの互換性に関しては、このツールが使用するnpmパッケージは広く使われているものに限定されるため、実用上の問題が発生するリスクは低い。

## 結果

### 良い影響

- TypeScriptの直接実行に追加ツールが不要になる
- パッケージマネージャの選択を検討する必要がない
- `devDependencies`による依存関係の分類が適切に管理できる
- 高速な起動によりCIの実行時間を短縮できる

### 悪い影響

- Node.jsとの互換性は高いものの網羅的ではなく、採用するnpmパッケージによっては動作しない場合もある
- エコシステムの歴史がNode.jsより浅く、一部のライブラリでBun固有の問題が発生しうる
