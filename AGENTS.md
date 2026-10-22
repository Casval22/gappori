# AGENTS.md

## 目的・範囲
- 詳細仕様は `docs/codex-prompt-v1.md` を読む。既存コードとユーザーの変更を尊重する。
- 「がっぽりナビ v1」をTypeScript（strict）＋React＋Viteで実装し、GitHub Pagesで公開可能にする。
- 1台で1〜4人分を扱う。DB・認証・サーバーAPI・端末間同期・カメラは導入しない。

## 実装原則
- 日本語・スマホ優先。型は最大8列の積み上げ図、8色＋列番号で表示し、「＋」から追加できる。
- 計算エンジンはUI・保存処理に依存しない純粋なTypeScriptとし、重い処理はWeb Workerへ分離する。
- 未確認ルールを断定せず、設定可能にする。不明値と0を区別し、仮定は `docs/assumptions.md` に記録する。
- 全員共通の抽選による相関を扱う。FC選択に後半の抽選結果を先取りして使わない。
- 未知の配当を創作しない。配当不明時は確率比較に留め、厳密値・近似・デモを区別する。
- 型・設定・履歴はlocalStorageに保存し、JSONでバックアップ・復元できるようにする。
- 推薦表示だけでは残高を変更しない。既存データの削除・上書きは確認を必要とする。
- HashRouterとViteのbase設定でGitHub Pagesのサブパスに対応する。

## 環境・作業
- 不足する `.gitignore`、package.json、設定ファイル、テスト、GitHub Actions、READMEも整備する。
- npmを使用し、package-lock.jsonを管理対象に含める。対応Node.js LTSを開発環境とCIで揃える。
- 依存物・ビルド成果物・テスト出力・秘密情報をGit管理に含めない。
- 無関係な削除、無断のpush、公開範囲・リポジトリ管理設定の変更は行わない。

## 検証・報告
- `npm run typecheck`、`npm run lint`、`npm run test`、`npm run test:e2e`、`npm run build` を整備して実行する。testは単発実行にする。
- 数理モデル、8列表示、人数切替、保存・復元、GitHub Pages相当のサブパスを検証する。
- モックだけで終了しない。実装内容・検証結果・制限・必要な手動操作を日本語で報告する。
- 未実行のテストや未実施の公開を、完了したと報告しない。
