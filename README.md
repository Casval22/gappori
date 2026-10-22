# がっぽりナビ v1

型の積み上げ図からBET候補を比較する、日本語・スマートフォン優先の非公式プレイ支援ツールです。1台で1〜4人を扱い、全員共通の抽選を評価します。配当・利益・プレイ時間を保証しません。

React / TypeScript strict / Vite / Tailwind CSS / Zustand / Zod。ブラウザ内だけで動作し、DB・認証・サーバーAPI・APIキーは不要です。端末間同期、カメラ、実機との自動連携はありません。

## 起動

既存環境とCIをNode.js **22.15.0（22 LTS系）**に統一しています。`.nvmrc` と `package.json` のenginesを参照してください。

```sh
nvm install
nvm use
npm ci
npm run dev
```

表示されたローカルURLを開きます。nvmを使わない場合も、同じNode.js版を用意してください。依存の取得にインターネット接続は必要ですが、アプリ起動後の計算・保存に外部API通信は必要ありません。

```sh
npm run build
npm run preview
```

成果物は `dist/`。ローカル既定baseは `/` です。

## 使い方

1. 人数とスタイルを選び、実機と見比べて型をタップ。初期残高300枚・上限20枚は仮の入力値です。各人の「編集」から実際の条件へ変更してください。
2. 合う型がなければ「＋ 型を追加」。1〜8列、正整数、通常ポケット合計を満たしたときに保存可能です。
3. 推薦の列番号・要求数・皿数を確認。表示だけで残高は変わりません。各案の費用、成立確率、推定操作時間を比較できます。
4. 配当が分かれば「配当入力」。総払出を「指定数量の合計」か「1皿・数量比例確認済み」から選びます。前ラウンドの配当は再確認するまで収支計算に使いません。
5. 必要に応じて前半3球からFC対象を確認。獲得済み条件を明示できます。
6. 実際の結果だけを記録し、費用・通常払出・追加支出・追加獲得を確認して精算。直前の記録は取消可能です。
7. 「次のラウンド」でラウンドを進めます。未記録結果を自動的に外れとして扱いません。

## 計算の意味と制限

- **厳密**：仮定した均等・非復元モデル内の成立確率、FCなしの収支分布、期待払出。実機の実測値ではありません。
- **推定**：FCありの収支分布と持続シミュレーションはseed付きMonte Carlo。試行数と誤差目安/信頼区間を表示します。
- **探索範囲内のおすすめ**：候補の枝刈り・ビーム探索を行います。数学的な大域最適解ではありません。
- **手入力**：実機で確認した配当と実績。未入力配当を0にしません。配当不明では確率・操作量・予算制約のみ比較し、期待収支や持続回数を出しません。
- **デモ**：明示操作後だけ架空配当を使用し、画面全体に表示します。デモ中は実績記録できず、デモ状態は保存しません。デモ中の条件変更は一時的で、終了時に実データへ戻ります。
- FCの初期率は不明です。各行最大1個、行間・人間の獲得独立、効果量と対象列は設定可能な仮説。前半3球を見て選び、後半を先取りしません。
- 持続時間は**現在の型・配当・ルール・BETを固定して独立ラウンドを反復した場合**。数量固定で、支払えない人から停止します。H回を上限に打ち切る平均です。実機の将来の型や実時間を保証しません。
- 特殊抽選、スタンプ、漁、JPの報酬最適化は対象外。実績では追加支出/獲得として入力できます。
- 結果履歴には計算時BET構成を記録します。実機で変更したBETベクトルの編集はなく、実際の費用・払出を入力して管理します。

詳細：[仮定](docs/assumptions.md) / [数理モデルと評価式](docs/model.md) / [構成と不変条件](docs/architecture.md)。元の仕様書は `codex_prompt_gappori_v1.md` を変更せず、同内容を [docs/codex-prompt-v1.md](docs/codex-prompt-v1.md) にも配置しました。

## 保存とバックアップ

型・ルール・4人分の条件・実績履歴は、このブラウザのlocalStorageに保存します。**別端末には自動共有されず、ブラウザのデータ削除で失われます。** 公開baseを含む `gappori-navi:<base>:v1` という専用キーを使用します。

「履歴・データ」からJSONをエクスポートし保管してください。復元は2MB・schemaVersion・値の範囲・型の整合性を検証し、確認後に全データを置き換えます。破損/未対応バージョンのデータは自動上書きせず保護します。「保存中の元JSONを退避」で取り出せます。容量不足や保存禁止時も一時的な利用は継続できます。

上限は型100件、配当500件、丸皿100件、履歴200件。自動消去はせず、バックアップ後に確認付きの整理操作を行います。複数タブで変更が競合した場合は保存を停止し、JSON退避と再読み込みを促します。

## 検証

```sh
npm run typecheck
npm run lint
npm run test
PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium
npm run test:e2e
npm run build
```

`test` は単発実行です。`npm run format` で整形、`npm run format:check` で整形確認ができます（元のAGENTS.mdと仕様書は整形対象外）。Playwrightは実Workerを含む本番ビルドを `/pages-test/` で起動し、360px・390px・1280pxを確認します。主要画面のスクリーンショットは `test-results/`、HTMLレポートは `playwright-report/` に出力します。テスト出力、依存、ビルド成果物はGit対象外です。

実際の検証結果と未検証範囲は [docs/verification.md](docs/verification.md) を参照してください。

## GitHub Pagesへの公開（利用者が行う操作）

この作業では **push、リポジトリ管理設定の変更、公開は実施していません**。リモートURLは未設定でした。

1. GitHubで公開先リポジトリを用意し、必要な公開範囲を自分で選択します。
2. この変更内容を確認し、コミット・リモート登録・pushを行います。既にリモートがある場合は追加不要です。

   ```sh
   git status
   git add .gitignore .nvmrc .prettierignore .prettierrc.json package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts eslint.config.js playwright.config.ts index.html src e2e scripts docs .github README.md AGENTS.md codex_prompt_gappori_v1.md
   git commit -m "Implement Gappori Navi v1"
   git remote add origin <自分のGitHubリポジトリURL>
   git push -u origin main
   ```

3. GitHubの **Settings → Pages → Build and deployment → Source: GitHub Actions** を選択します。
4. Actionsの **Deploy GitHub Pages** を実行します（既定ブランチのpushでも実行）。検証→ビルド→公開の順で動きます。最初のpush時点でPages未設定だった場合は、設定後に再実行してください。
5. 成功後、`github-pages` 環境またはPages設定に表示されたURLを開き、型選択、Worker計算、再読み込みを確認します。

リポジトリ名から `/<repo>/` を自動設定します。`*.github.io` リポジトリなら `/`。ルート公開やカスタムドメインの場合は、必要に応じて自分で **Settings → Secrets and variables → Actions → Variables** に `VITE_BASE_PATH=/` を設定します。秘密鍵ではありません。リポジトリ名・ユーザー名はコードに固定していません。

手元で明示する例：

```sh
VITE_BASE_PATH=/任意のサブパス/ npm run build
VITE_BASE_PATH=/任意のサブパス/ npm run preview
```

HashRouterのためページは `/#/settings` のように遷移し、サーバーのSPAリライトは不要です。base変更時はブラウザの保存領域も変わるため、JSONを移行してください。

CIはPRと既定ブランチpushで検証し、PRからは公開しません。公開workflowは既定ブランチpushまたは手動実行を受け付け、既定ブランチに限定して公開します。基本権限はcontents: read、公開ジョブだけpages: write / id-token: write。`github-pages`環境と同時公開の排他制御を使用します。

公式の [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1)、[setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0)、[upload-pages-artifact](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0)、[deploy-pages](https://github.com/actions/deploy-pages) を確認し、対応するメジャー版を指定しています。Node.js 22は [公式リリース一覧](https://nodejs.org/en/about/previous-releases) のLTS系列です。
