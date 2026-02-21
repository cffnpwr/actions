# cffnpwr/actions

[![GitHub License](https://img.shields.io/github/license/cffnpwr/actions?style=flat)](./LICENSE)

A shared GitHub Actions workflows for cffnpwr.

[日本語のREADMEはこちら](./README-ja.md)

## How to Use

When using a reusable workflow, configure it as follows:

```yaml
jobs:
  status-check:
    uses: cffnpwr/actions/.github/workflows/status-check.yaml@<SHA>
    secrets: inherit
```

## License

[MIT License](./LICENSE)
