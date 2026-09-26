#!/usr/bin/env bash
# gh-pages ブランチへ静的ファイルを公開（または削除）するスクリプト
#
# 使い方:
#   scripts/publish-gh-pages.sh deploy <公開元ディレクトリ> <公開先ディレクトリ> <コミットメッセージ>
#   scripts/publish-gh-pages.sh remove <公開先ディレクトリ> <コミットメッセージ>
#
# 公開先ディレクトリに "." を指定するとルート（本番サイト）を更新します。
# ルート更新時は PR プレビュー用の `pr-*` ディレクトリを保持し、それ以外の古いファイルは削除します。
#
# 認証には環境変数 GITHUB_TOKEN を、公開先リポジトリには GITHUB_REPOSITORY（owner/repo）を使用します。
#
# 本番デプロイと PR プレビューが同時に gh-pages へ push すると non-fast-forward で
# 失敗するため、push が拒否された場合は最新の gh-pages を取り直して再適用・再 push します。

set -euo pipefail

readonly MAX_ATTEMPTS=5
readonly BRANCH="gh-pages"

mode="${1:?モード（deploy / remove）を指定してください}"
case "$mode" in
  deploy)
    src_dir="$(cd "${2:?公開元ディレクトリを指定してください}" && pwd)"
    dest_dir="${3:?公開先ディレクトリを指定してください}"
    message="${4:?コミットメッセージを指定してください}"
    ;;
  remove)
    dest_dir="${2:?公開先ディレクトリを指定してください}"
    message="${3:?コミットメッセージを指定してください}"
    if [ "$dest_dir" = "." ] || [ -z "$dest_dir" ]; then
      echo "ルートディレクトリは削除できません" >&2
      exit 1
    fi
    ;;
  *)
    echo "不明なモードです: $mode" >&2
    exit 1
    ;;
esac

case "$dest_dir" in
  /* | *..*)
    echo "公開先ディレクトリにはリポジトリ内の相対パスを指定してください: $dest_dir" >&2
    exit 1
    ;;
esac

: "${GITHUB_TOKEN:?環境変数 GITHUB_TOKEN を設定してください}"
: "${GITHUB_REPOSITORY:?環境変数 GITHUB_REPOSITORY を設定してください}"

repo_url="${PAGES_REPO_URL:-https://github.com/${GITHUB_REPOSITORY}.git}"

# トークンをリモート URL やディスク上の設定に残さないよう、環境変数経由で git に認証ヘッダーを渡す
auth="$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')"
echo "::add-mask::$auth"
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0="http.https://github.com/.extraheader"
export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $auth"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# gh-pages ブランチを作業ディレクトリへ取得する（存在しない場合は空のブランチを用意する）
checkout_pages() {
  rm -rf "$work_dir/pages"
  if git ls-remote --exit-code --heads "$repo_url" "$BRANCH" > /dev/null; then
    git clone --quiet --depth 1 --branch "$BRANCH" "$repo_url" "$work_dir/pages"
  else
    if [ "$mode" = "remove" ]; then
      echo "$BRANCH ブランチが存在しないため、処理をスキップします"
      exit 0
    fi
    git init --quiet "$work_dir/pages"
    git -C "$work_dir/pages" checkout --quiet --orphan "$BRANCH"
    git -C "$work_dir/pages" remote add origin "$repo_url"
  fi
  git -C "$work_dir/pages" config user.name "github-actions[bot]"
  git -C "$work_dir/pages" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
}

# 変更内容を作業ディレクトリへ反映する
apply_changes() {
  local pages="$work_dir/pages"
  if [ "$mode" = "remove" ]; then
    rm -rf "${pages:?}/$dest_dir"
  elif [ "$dest_dir" = "." ]; then
    # ルート更新: .git と PR プレビュー（pr-*）以外を入れ替える
    find "$pages" -mindepth 1 -maxdepth 1 ! -name .git ! -name 'pr-*' -exec rm -rf {} +
    cp -R "$src_dir/." "$pages/"
  else
    rm -rf "${pages:?}/$dest_dir"
    mkdir -p "$pages/$dest_dir"
    cp -R "$src_dir/." "$pages/$dest_dir/"
  fi
  # Jekyll による加工を無効化する（`_` で始まるファイルなどを配信するため）
  touch "$pages/.nojekyll"
  git -C "$pages" add --all
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  checkout_pages
  apply_changes
  if git -C "$work_dir/pages" diff --cached --quiet; then
    echo "変更がないため、コミットをスキップします"
    exit 0
  fi
  git -C "$work_dir/pages" commit --quiet -m "$message"
  if git -C "$work_dir/pages" push --quiet origin "HEAD:$BRANCH"; then
    echo "$BRANCH ブランチへの push に成功しました（試行 $attempt 回目）"
    exit 0
  fi
  echo "$BRANCH ブランチへの push が拒否されました。最新の状態を取得して再試行します（$attempt/$MAX_ATTEMPTS）" >&2
  sleep $((attempt * 3))
done

echo "$BRANCH ブランチへの push に $MAX_ATTEMPTS 回失敗しました" >&2
exit 1
