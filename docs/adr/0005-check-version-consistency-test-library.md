---
status: superseded by ADR-0008
date: 2026-03-05
---

# ADR-0005: check-version-consistency のテストライブラリ選択

## コンテキスト

ADR-0003にて、check-version-consistencyの実装言語としてPythonを採用することを決定した。
本ADRでは、このモジュールにテストを追加するにあたって使用するテストライブラリを決定する。

テスト対象となるコンポーネントは以下の通り。

- `checker.py`: 複数ソース間のバージョン不一致を検出する純粋関数
- `utils/`: ツール名正規化・バイナリパス解決のユーティリティ関数
- `providers/`: `subprocess`経由で`mise` / `nix`を呼び出すプロバイダ
- `models/`: Pydanticモデル

## 検討した選択肢

### 選択肢1: pytest

サードパーティのテストフレームワーク。Pythonエコシステムで最も広く使われている。

#### 良い点

- `assert`文をそのまま使えるため可読性が高い
- テスト失敗時のdiff表示が詳細（値の中身まで表示）
- `@pytest.mark.parametrize`でパラメータ化テストを簡潔に記述できる
- フィクスチャが強力（スコープ制御・依存注入）
- `monkeypatch`により`subprocess`等の外部呼び出しを容易にモックできる
- ruffの`PT`ルールセットと組み合わせることでpytestスタイルを静的に強制できる

#### 悪い点

- 外部依存が追加される（`dev`グループへの追加が必要）

### 選択肢2: unittest

Pythonの標準ライブラリに含まれるテストフレームワーク。

#### 良い点

- 標準ライブラリのため追加依存不要
- `unittest.mock`が同梱でモックが利用可能

#### 悪い点

- `TestCase`クラスの継承が必須でボイラープレートを多く含む
- アサーションが`self.assertEqual(...)`形式で可読性が低い
- パラメータ化テストが冗長（`subTest`の使用か外部ライブラリが別途必要）
- テスト失敗時のエラーメッセージが素っ気なく、差分表示が限定的
- フィクスチャの仕組みが`setUp`/`tearDown`のみで粒度が粗い

## 決定

選択肢1（pytest）を採用する。

`checker.py`や`utils/`は入力パターンが多く`@pytest.mark.parametrize`との相性が良い。
`providers/`では`subprocess`をモックする必要があるが、`monkeypatch`により`unittest.mock`よりも直感的に記述できる。
また、`ruff.toml`ですでに多くのリントルールを有効化しており、`PT`ルールセットを追加することでpytestスタイルを静的に強制できる。
追加依存は`dev`グループへの1パッケージ追加のみであり、コストは限定的である。

## 結果

### 良い影響

- `assert`文による高い可読性と詳細なエラー表示でテストの保守性が上がる
- `@pytest.mark.parametrize`で純粋関数のパラメータ化テストを簡潔に記述できる
- `monkeypatch`で`subprocess`呼び出しを容易にモックでき、プロバイダのユニットテストが書きやすい

### 悪い影響

- `dev`依存グループに`pytest`が追加される（`pyproject.toml`と`uv.lock`の変更が必要）
