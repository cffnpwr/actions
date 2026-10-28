---
status: accepted
date: 2026-10-28
---

# ADR-0002: Docker buildのReusable Workflowにおける差分の判定方法

## コンテキスト

`docker-build.yaml`は、イメージ1つ分をplatformごとにビルドし、manifest listとしてGHCRへpushするReusable Workflowである。
ビルドした結果が既存のイメージと同じ内容の場合、pushしないことを要件とする。
イメージの内容が同じでも、ビルドし直したイメージをpushすると、タグの指すdigestが変わる。
タグの指すdigestが変わると、利用側でRenovateによるdigestの更新・イメージの再pullが発生する。
この要件は、内容が変わらないときにこれらの発生を避けるためのものである。

この要件を満たすには、次の2つを決める必要がある。

- 同じ入力から同じ内容のイメージを得るために、タイムスタンプをどう固定するか
- 何を比較して「同じ内容」と判定するか

`docker/build-push-action`は既定でprovenance attestationを付与する。
provenanceはビルドの開始・終了時刻と`buildInvocationID`を含むため、ビルドのたびに内容が変わる。
provenanceはイメージの出所を利用側が検証するために残す。

## 検討した選択肢

### 選択肢1: `SOURCE_DATE_EPOCH`の値

#### 選択肢1-A: ビルドコンテキストを最後に変更したcommitの時刻

`git log -1 --pretty=%ct -- <context>`の値を使う。

##### 良い点

- image configの`created`がビルドコンテキストを最後に変更したcommitの時刻になる

##### 悪い点

- `rewrite-timestamp=true`は、`SOURCE_DATE_EPOCH`の値より新しいファイルの時刻をその値に書き換える。そのため、commitが変わるとビルド中に作成したファイルの時刻が変わる。ファイルの内容が同じレイヤーでもdigestが変わり、利用側で再pullが発生する
- Dockerfile frontendは`WORKDIR`の作成時刻に`SOURCE_DATE_EPOCH`の値を使うため、値が変わると`WORKDIR`以降のビルドキャッシュを使えない
- `actions/checkout`で`fetch-depth: 0`等の履歴の取得が必要になる

#### 選択肢1-B: `0`

##### 良い点

- commitに依存せず、内容が同じレイヤーは同じdigestになる
- ビルドキャッシュのキーがcommitに依存しない

##### 悪い点

- image configの`created`が1970-01-01になる

### 選択肢2: 比較に使う値

#### 選択肢2-A: platformごとのimage indexのdigest

##### 良い点

- `docker/build-push-action`の`digest` outputをそのまま使える

##### 悪い点

- provenanceを含むため、ビルドのたびに変わる

#### 選択肢2-B: platformごとのimage manifestのdigest

##### 良い点

- provenanceの影響を受けない

##### 悪い点

- レイヤーの圧縮結果を含むため、BuildKitのバージョン等で圧縮結果が変わるとdigestが変わる
- attestationを含むビルドでは、`docker/build-push-action`の出力から取得できない

#### 選択肢2-C: platformごとのimage configのdigest

image configは`rootfs.diff_ids`として非圧縮のレイヤーのdigestを含む。

##### 良い点

- provenanceとレイヤーの圧縮結果の影響を受けない

##### 悪い点

- attestationを含むビルドでは`docker/build-push-action`の出力から取得できないため、OCI layoutへ出力して読み取る処理が必要になる
- 比較用とpush用で、1つのjobの中で2回ビルドする（2回目はビルドキャッシュを使う）

## 決定

`SOURCE_DATE_EPOCH`は`0`とし、`rewrite-timestamp=true`でイメージ内のファイルの時刻も書き換える（選択肢1-B）。
内容が変わらないレイヤーのdigestを保ち、利用側の再pullを避けることを優先する。

イメージの作成日時として、ビルドコンテキストを最後に変更したcommitの時刻を使う。
この値は、image manifestのannotation`org.opencontainers.image.created`に設定する。
BuildKitのimage exporterは、1つの`SOURCE_DATE_EPOCH`の値をファイルの時刻と`created`の両方に使う。
この動作は`moby/buildkit`の`exporter/containerimage/writer.go`で確認した。
そのため、ファイルの時刻を`0`にしたまま、`created`だけにcommitの時刻を設定できない。
image configのラベルに設定すると、作成日時だけが異なるイメージもimage configのdigestが変わり、pushの対象になる。
image manifestのannotationはimage configに含まれないため、作成日時だけが異なるイメージは変更なしと判定できる。
pushを省略した場合は既存のイメージが残るため、作成日時はイメージの内容が最後に変わったときのcommitの時刻になる。

比較にはplatformごとのimage configのdigestを使う（選択肢2-C）。
provenanceを残したまま、provenanceの影響を受けずにイメージの内容を比較できるためである。

各platformの`build` jobは、まずOCI layoutへ出力し、image configのdigestを既存の全タグと比較する。
既存のタグのうち1つでもimage configのdigestが異なるplatformだけ、再度ビルドしてdigestでpushする。
`merge` jobは、変更のあるplatformがない場合はmanifest listを作成しない。
変更のあるplatformがある場合、変更のないplatformには既存のタグのmanifestとattestation manifestのdescriptorを使う。
これにより、変更のないplatformのprovenanceを保ったままmanifest listを作成する。

## 結果

### 良い影響

- イメージの内容が変わらない限り、タグの指すdigestは変わらない
- provenance attestationを残せる

### 悪い影響

- 変更のあるplatformでは2回ビルドする
- Dockerfileが再現可能でない場合（パッケージのインストール時のログに時刻が残る等）、内容が毎回変わり、毎回pushする
- image configの`created`が1970-01-01になる。利用側は、作成日時をimage manifestのannotationから読む必要があり、`docker image inspect`には表示されない
- ビルドコンテキストを最後に変更したcommitの時刻を取得するため、`actions/checkout`で履歴を取得する
