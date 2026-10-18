# ツイート画像ジェネレーター

アイコン画像・ユーザー名・ユーザーID・本文を入力すると、ツイート風の画像を生成し、PNG ファイルとしてダウンロードできる静的 Web サイトです。

> 本ツールはジョーク・パロディ・資料作成などを目的としたものです。実在の人物・団体へのなりすましや、事実と誤認させる目的での利用はお控えください。

## 主な機能

- アイコン画像の添付（未選択時はデフォルトアイコン）
- ユーザー名の入力（50 文字以内）
- ユーザーIDの入力（半角英数字と `_` で 15 文字以内。先頭の `@` は自動で除去）
- 本文の入力（280 文字以内。改行・絵文字に対応）
- テーマ（ライト / ダーク）の選択
- 入力内容からツイート風画像を生成して表示（投稿日時は生成時刻）
- 本文中の URL・ハッシュタグ・メンションはリンク色で表示
- スマートフォン画面の幅（390px）で描画し、結果画面では画面幅に合わせて拡大表示
- PNG ファイルでダウンロード（3 倍解像度・横幅 1170px）
- 入力内容や画像はブラウザ内で処理され、外部に送信されない

## 技術スタック

- HTML / CSS / JavaScript（フレームワーク・外部ライブラリなし、ビルド不要）
- Canvas 2D API（画像の生成と PNG 書き出し）
- Node.js 製のサイト検証スクリプト（`scripts/check-site.mjs`）
- GitHub Pages（`gh-pages` ブランチ）

## 開発

### 必要な環境

- Node.js（サイト検証スクリプトの実行に使用。CI は Node.js 24）
- `package.json` は無く、依存パッケージのインストールは不要です

### コマンド

ビルドは不要です。`site/index.html` をブラウザで直接開くか、任意の静的サーバーで配信してください。

```bash
npx http-server site          # 静的サーバーで site/ を配信する例
node scripts/check-site.mjs   # CI と同じサイト検証（参照ファイルの存在・id の重複・JavaScript の構文）
```

### リポジトリの初期設定（手動）

以下はリポジトリの設定画面で一度だけ行ってください。

- **Settings → Pages**: 「Deploy from a branch」→ ブランチ `gh-pages` / フォルダ `/ (root)`
- **Settings → Branches（または Rules → Rulesets）**: `main` ブランチを保護
  - PR を必須にする / force push を禁止する
  - 必須ステータスチェックに `サイト検証`・`check-title` を指定する
- **Settings → Actions → General**: Workflow permissions は `Read repository contents and packages permissions`（読み取りのみ）のままで問題ありません（書き込みが必要なジョブは各ワークフローで個別に権限を付与しています）
- **Settings → Code security**: Secret scanning / Dependabot alerts / Code scanning（CodeQL）を有効化

## ディレクトリ構成

```text
site/
  index.html             入力画面・生成結果画面（1 ページ内で切り替え）
  style.css              スタイル
  app.js                 入力チェック・Canvas 描画・PNG 書き出し
scripts/
  check-site.mjs         サイトの検証（参照ファイルの存在・JavaScript の構文）
  publish-gh-pages.sh    gh-pages ブランチへの公開・削除（push 競合時は自動再試行）
```

## デプロイ

- `main` へのプッシュ時（`site/` などの変更時。Actions からの手動実行も可）に `deploy.yml` が `site/` の内容を `gh-pages` ブランチへデプロイします。公開 URL は `https://<ユーザー名>.github.io/<リポジトリ名>/` です
- PR ごとに `pr-preview.yml` がプレビューを `gh-pages` の `pr-<番号>/` に公開し、PR を閉じると自動で削除します
- fork からの PR と Dependabot の PR は書き込み権限がないため、プレビューを作成しません

## 開発ルール

開発ルールは [AGENTS.md](./AGENTS.md) を参照してください。
貢献の手順は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## ライセンス

MIT
