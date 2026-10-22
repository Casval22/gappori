# 構成と境界

- `src/domain/`：Zodスキーマ・データ型・初期値・列番号/キー・精算の純粋変換。
- `src/engine/`：組合せ、状態列挙、FC選択、配当、共同評価、探索、持続シミュレーション。React、Zustand、DOM、localStorageに依存しない。
- `src/workers/`：Viteの `new URL('./calculation.worker.ts', import.meta.url)` で解決。計算/シミュレーションのWorker、通信プロトコル、Hook。
- `src/storage/`：唯一の保存I/O境界。schemaVersion=1、最大2MB、Zod検証、破損データの上書き保護。旧バージョンを勝手に移行しない。
- `src/app/`：HashRouterとZustand。永続化は400ms debounceしpagehideでflush。別タブのstorageイベントで保存を停止する。
- `src/components/`：積み上げ図、数値入力、ネイティブdialog。dialogのモーダルフォーカス制御・Escape・終了時のフォーカス復帰。
- `src/features/`：プレイ、型管理、設定/配当、履歴/バックアップ。
- `src/test/` / `**/*.test.*`：純粋モデル、ストレージ、UI部品テスト。
- `e2e/`：本番ビルドを `/pages-test/` で起動。360/390/1280pxのChromiumで実WorkerとlocalStorageを使用。

## 不変条件

1. 共通の物理結果を全員・全BETに適用する。
2. FC列は前半だけから決める。行の重複を統合する。
3. nullと0、手入力配当とデモ配当を分ける。
4. 表示列順を要求、配当キー、履歴で保つ。型編集で履歴を変えない。
5. 推薦・型選択・人数変更・次ラウンドは残高を変更しない。
6. 精算はroundIdごとに一度のみ。直前取消は残高が記録後の値と一致するときのみ許す。
7. 選択・ルール・予算・配当等の変更で前Workerをterminateし再起動。requestId・roundId・入力キーが一致する返答だけ表示する。
8. キャッシュはWorkerインスタンス内の状態/行確率だけ。永続化しない。入力キーは全入力のJSON文字列そのものを使い、短いハッシュの衝突を避ける。
9. 公開パスはVite baseとHashRouterで扱い、Worker/アセットに固定ルート絶対URLを使わない。
10. API・認証・DB・CDN・外部フォント・アクセス解析・端末間同期・Service Workerは導入しない。

`AGENTS.md` は既存内容を維持し、追加の設計不変条件とデプロイ注意点をこの文書とREADMEに記録した。
