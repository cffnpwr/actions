---
status: accepted
date: 2026-03-18
---

# ADR-0010: check-version-consistencyのProvider実装パターン

## コンテキスト

ADR-0008にてTypeScriptへの移行を決定した。
旧Python実装では、CLI引数のメタデータ定義と実際のバージョン取得ロジックを統合していた。
そのため、`@classmethod`と抽象クラス（`BaseProvider`）を組み合わせたクラスベースの設計を採用していた。

TypeScriptに移行するにあたり、プロバイダの設計パターンを再考する必要がある。
本ツールの要件は以下の通りである。

1. CLIの初期化時（実行前）に、各プロバイダが要求するオプション（例: `--project-dir`）の定義を動的に収集できること
2. CLI引数をパースした後、その値を元に各プロバイダのインスタンス（実体）を生成できること
3. 生成されたインスタンスが、自身に紐づく状態（ディレクトリパス等）を用いてバージョン情報を取得できること

TypeScriptの型システム（特に`interface`）を最大限に活かしつつ、これらの要件を満たす設計を決定する。

## 検討した選択肢

### 選択肢1: クラスベース（旧Python実装の踏襲）

抽象クラス`BaseProvider`を定義し、メタデータを`static`メソッド、実行ロジックをインスタンスメソッドとして実装する。

#### 良い点

- メタデータと実行ロジックが1つのクラスにまとまり、凝集度が高い
- 旧Python実装の構造をそのまま移植できるため、概念のマッピングが容易である

#### 悪い点

- TypeScriptの`interface`や`abstract class`では、`static`メンバの実装を型レベルで強制することが難しい（回避策は存在するが冗長になる）
- クラス構文特有のボイラープレート（`constructor`の定義、`this.`の多用）が増加する

### 選択肢2: Factoryオブジェクトパターン（関数型アプローチ）

プロバイダのメタデータと生成ロジックを持つ「Factory」と、バージョン取得ロジックを持つ「Provider実体」を2つの`interface`に分離する。

```typescript
interface ProviderFactory {
  readonly sourceName: string;
  getOptions(): OptionSpec[];
  create(args: Record<string, string | undefined>): Result<Provider, Error>;
}

interface Provider {
  fetchToolVersions(): Promise<Result<Record<string, string>, Error>>;
}
```

#### 良い点

- `interface`を用いてメタデータ（`sourceName`, `getOptions`）の実装を型レベルで強制できる
- クラスの代わりにオブジェクトリテラルとクロージャを使用することで、状態をカプセル化しつつ簡潔に記述できる
- 状態と振る舞いが関数として表現されるため、テスト時のモック化が極めて容易である

#### 悪い点

- ファクトリと実体でインターフェースが分かれるため、クラスベースと比較して概念がわずかに複雑になる

### 選択肢3: 遅延評価（Lazy）プロバイダパターン

インスタンス生成のフェーズを廃止し、すべてのCLIオプションを実行時のメソッド呼び出しに直接渡す。

```typescript
interface Provider {
  readonly sourceName: string;
  getOptions(): OptionSpec[];
  fetchToolVersions(args: Record<string, string | undefined>): Promise<Result<Record<string, string>, Error>>;
}
```

#### 良い点

- インターフェースが1つに統合され、構造が最もシンプルになる
- プロバイダが状態を持たない（stateless）ため、副作用の管理が不要になる

#### 悪い点

- メソッドを呼び出すたびに引数のバリデーションや初期化処理が実行され、事前構築（Factory）の恩恵が得られない
- 本ツールをCLI以外からライブラリとして利用する場合、不要な`args`オブジェクトを構築して渡す手間が生じる

## 決定

選択肢2（Factoryオブジェクトパターン）を採用する。

TypeScriptへの移行（ADR-0008）の最大の目的は、型システムの表現力を活かして安全な設計を実現することである。
選択肢1（クラスベース）はTypeScriptの型システム（静的メンバの制約）と相性が悪く、移行の目的を十分に達成できない。
選択肢3（遅延評価）はシンプルだが、ライブラリとしての再利用性を損なう設計である。

選択肢2は、`interface`による型制約の強制と、クロージャによる状態のカプセル化を両立でき、TypeScriptのパラダイムに最も適している。

## 結果

### 良い影響

- プロバイダ追加時に実装すべきメタデータとロジックが`interface`によって型レベルで強制され、実装漏れを防げる
- クラスベースのボイラープレートが削減され、コードが簡潔になる
- 関数ベースの設計により、テスト時のモック注入が容易になる

### 悪い影響

- プロバイダの実装がFactoryと実体の2つの概念に分かれるため、旧Python実装の単一クラス構造と比較して学習コストがわずかに上昇する
