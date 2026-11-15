# create-github-app

`create-github-app`はmanifest flowでGitHub Appを登録し、リポジトリへのインストールを待ちます。
その後、定義ファイルの書き込み先にClient IDと秘密鍵を書き込みます。

[README.md for English is available here](./README.md).

## 使い方

複数のリポジトリにインストールして、各リポジトリのCIがTerraformのplan・applyに使うGitHub Appの定義は[`apps/`](./apps)にあります。
定義ファイルの例と各項目の説明は[`app_example.yaml`](./app_example.yaml)にあります。
GitHub Appは次の手順で作ります。

1. GitHub Appの定義ファイルを取得する

   ```sh
   curl -fsSLO https://raw.githubusercontent.com/cffnpwr/actions/<SHA>/modules/github-app/apps/terraform-plan.yaml
   ```

2. 定義ファイルとインストール先のリポジトリを指定して、`create-github-app`を実行する

   ```sh
   go run github.com/cffnpwr/actions/modules/github-app/cmd/create-github-app@<SHA> \
     --config terraform-plan.yaml \
     --repo cffnpwr/home-iac \
     --repo cffnpwr/dotfiles
   ```

3. `create-github-app`が開いたブラウザーでGitHub Appを作成し、`--repo`のリポジトリにインストールする

インストールを確認した後、`create-github-app`は書き込み先にClient IDと秘密鍵を書き込みます。
最後に、作成したGitHub Appのslug・App ID・Client IDを標準出力に表示します。
