# ツイート画像ジェネレーター

アイコン画像・ユーザー名・ユーザーID・本文を入力すると、ツイート風の画像を生成し、PNG ファイルとしてダウンロードできる静的 Web サイトです。GitHub Pages で公開することを想定しています。

> ⚠️ 本ツールはジョーク・パロディ・資料作成などを目的としたものです。実在の人物・団体へのなりすましや、事実と誤認させる目的での利用はお控えください。

## 機能

- **ツイート文入力画面**
  - アイコン画像の添付（未選択時はデフォルトアイコン）
  - ユーザー名の入力（50 文字以内）
  - ユーザーIDの入力（半角英数字と `_` で 15 文字以内。先頭の `@` は自動で除去）
  - 本文の入力（280 文字以内。改行・絵文字に対応）
  - テーマ（ライト / ダーク）の選択
- **生成結果画面**
  - 入力内容からツイート風画像を生成して表示（投稿日時は生成時刻）
  - 本文中の URL・ハッシュタグ・メンションはリンク色で表示
  - スマートフォン画面の幅（390px）で描画し、結果画面では画面幅に合わせて拡大表示
  - PNG ファイルでダウンロード（3 倍解像度・横幅 1170px）

画像の生成は Canvas 2D API のみで行っており、外部ライブラリやサーバーは使用していません。入力内容や画像はブラウザ内で処理され、外部に送信されません。

## ディレクトリ構成

```
site/
├── index.html  # 入力画面・生成結果画面（1 ページ内で切り替え）
├── style.css   # スタイル
└── app.js      # 入力チェック・Canvas 描画・PNG 書き出し
scripts/
├── check-site.mjs       # サイトの検証（参照ファイルの存在・JavaScript の構文）
└── publish-gh-pages.sh  # gh-pages ブランチへの公開・削除（push 競合時は自動再試行）
```

## ローカルでの確認

ビルドは不要です。`site/index.html` をブラウザで直接開くか、任意の静的サーバーで配信してください。

```bash
npx http-server site
```

CI と同じサイト検証はローカルでも実行できます（Node.js のみで動作し、依存パッケージは不要です）。

```bash
node scripts/check-site.mjs
```

## GitHub Pages での公開

`main` ブランチへのプッシュ時に `.github/workflows/deploy.yml` が `site/` の内容を `gh-pages` ブランチへデプロイします。

初回のみ、リポジトリの **Settings → Pages** で「Deploy from a branch」を選び、ブランチ `gh-pages` / フォルダ `/ (root)` を指定してください。公開 URL は `https://<ユーザー名>.github.io/<リポジトリ名>/` です。

PR を作成すると `.github/workflows/pr-preview.yml` により `https://<ユーザー名>.github.io/<リポジトリ名>/pr-<PR番号>/` にプレビューがデプロイされ、PR を閉じると自動で削除されます。fork からの PR と Dependabot の PR は書き込み権限がないため、プレビューを作成しません。

## AI アシスタント運用方針

このテンプレートは **Claude をメインの AI アシスタント** として利用し、**Cursor / GitHub Copilot をサブツール** として併用するワークフローを想定しています。開発ルールの **正本は [`AGENTS.md`](./AGENTS.md)** で、各ツール向けの指示書はそれを参照する構成です。

| ツール | ファイル | 役割 |
| --- | --- | --- |
| 汎用 AI エージェント | [`AGENTS.md`](./AGENTS.md) | **正本**。すべてのルールはここに集約 |
| Claude Code | [`CLAUDE.md`](./CLAUDE.md) | `AGENTS.md` を参照 |
| Cursor | [`.cursor/rules/project.mdc`](./.cursor/rules/project.mdc) | `AGENTS.md` を参照 |
| GitHub Copilot | [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) | `AGENTS.md` を参照 |

## 含まれるもの

### AI 向け指示書
- `AGENTS.md` — **正本**（汎用 AI エージェント向け）
- `CLAUDE.md` — Claude Code 向け（`AGENTS.md` を参照）
- `.cursor/rules/project.mdc` — Cursor 向け（`AGENTS.md` を参照）
- `.github/copilot-instructions.md` — GitHub Copilot 向け（`AGENTS.md` を参照）

### Issue / PR
- `.github/ISSUE_TEMPLATE/` — バグ報告 / 機能要望 / 質問テンプレート
- `.github/PULL_REQUEST_TEMPLATE.md` — PR テンプレート（日本語）
- `.github/CODEOWNERS` — レビュー自動アサイン
- `CONTRIBUTING.md` / `SECURITY.md` — 貢献ガイドとセキュリティポリシー

### CI/CD
| ワークフロー | 実行タイミング | 内容 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push（main）/ PR | `site/` の検証（参照ファイルの存在・JavaScript の構文）とシェルスクリプトの shellcheck |
| `.github/workflows/pr-title.yml` | PR | PR タイトルが Conventional Commits 形式（`feat: ...` など）か検証 |
| `.github/workflows/pr-preview.yml` | PR | PR プレビューのデプロイ・URL コメント投稿・クローズ時の削除 |
| `.github/workflows/deploy.yml` | push（main、`site/` 変更時）/ 手動 | GitHub Pages（`gh-pages` ブランチ）へのデプロイ |
| `.github/workflows/codeql.yml` | push（main）/ PR / 毎週 | JavaScript とワークフロー定義のセキュリティスキャン |
| `.github/workflows/actionlint.yml` | ワークフロー変更時 | ワークフロー自体の Lint |
| `.github/workflows/release-drafter.yml` | push（main） | PR タイトルのプレフィックスからリリースノート草案を自動生成 |
| `.github/workflows/copilot-setup-steps.yml` | 手動 / 本ファイル変更時 | Copilot Coding Agent のビルド環境（Node.js・日本語フォント） |

- `.github/dependabot.yml` — GitHub Actions の週次自動更新（1 つの PR にまとめる）
- `.github/release-drafter.yml` — リリースノートの分類・バージョン決定ルール

### 環境差異の吸収
- `.editorconfig` — エディタ間のインデント／改行統一
- `.gitattributes` — テキスト/バイナリ・改行コードの正規化
- `.gitignore` — OS / 言語 / ビルド成果物
- `.vscode/extensions.json`, `.vscode/settings.json` — VSCode 推奨拡張・設定

### その他
- `LICENSE` — MIT

## リポジトリの初期設定（手動）

以下はリポジトリの設定画面で一度だけ行ってください。

- **Settings → Pages**: 「Deploy from a branch」→ ブランチ `gh-pages` / フォルダ `/ (root)`
- **Settings → Branches（または Rules → Rulesets）**: `main` ブランチを保護
  - PR を必須にする / force push を禁止する
  - 必須ステータスチェックに `サイト検証`・`check-title` を指定する
- **Settings → Actions → General**: Workflow permissions は `Read repository contents and packages permissions`（読み取りのみ）のままで問題ありません（書き込みが必要なジョブは各ワークフローで個別に権限を付与しています）
- **Settings → Code security**: Secret scanning / Dependabot alerts / Code scanning（CodeQL）を有効化

## VSCode 環境

VSCode をエディタとして使うワークフローを想定しています。`.vscode/extensions.json` に記載の拡張をインストールすると、Lint / Format / Spell check が即座に動きます。

## ライセンス

MIT
