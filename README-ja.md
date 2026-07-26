# cffnpwr/actions

[![GitHub License](https://img.shields.io/github/license/cffnpwr/actions?style=flat)](./LICENSE)

cffnpwrのためのGitHub Actions共有ワークフローです。

[README.md for English is available here](./README.md).

## How to Use

Reusable workflowを使用する際は以下のように設定します。

```yaml
jobs:
  status-check:
    uses: cffnpwr/actions/.github/workflows/status-check.yaml@<SHA>
    secrets: inherit
```

呼び出し元リポジトリに要件があるワークフローもあります。
その要件は以下のドキュメントに記載しています。

- [release-npm-package](./docs/release-npm-package.md)

## License

[MIT License](./LICENSE)
