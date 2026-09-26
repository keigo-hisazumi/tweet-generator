// site/ 配下の静的ファイルを検証するスクリプト（外部依存なし）
//
// - index.html が参照するローカルファイル（src / href）が実在するか
// - index.html 内の id 属性に重複がないか
// - JavaScript ファイルに構文エラーがないか（node --check）
//
// 使い方: node scripts/check-site.mjs [サイトのディレクトリ（既定: site）]

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const siteDir = path.resolve(process.argv[2] ?? 'site');
const errors = [];

const indexPath = path.join(siteDir, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`エラー: ${indexPath} が見つかりません`);
  process.exit(1);
}
const html = readFileSync(indexPath, 'utf8');

// 参照先ファイルの存在確認（外部 URL・データ URI・アンカーは対象外）
const refPattern = /\s(?:src|href)\s*=\s*["']([^"']+)["']/gi;
for (const [, ref] of html.matchAll(refPattern)) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) continue;
  const filePath = path.join(siteDir, decodeURI(ref.split(/[?#]/)[0]));
  if (!existsSync(filePath)) {
    errors.push(`index.html が参照している ${ref} が存在しません`);
  }
}

// id 属性の重複確認
const seenIds = new Set();
for (const [, id] of html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)) {
  if (seenIds.has(id)) errors.push(`index.html で id="${id}" が重複しています`);
  seenIds.add(id);
}

// JavaScript の構文確認
const jsFiles = readdirSync(siteDir, { recursive: true })
  .filter((file) => /\.m?js$/.test(file))
  .map((file) => path.join(siteDir, file));
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    errors.push(`${path.relative(process.cwd(), file)} に構文エラーがあります:\n${error.stderr}`);
  }
}

if (errors.length > 0) {
  for (const message of errors) console.error(`エラー: ${message}`);
  process.exit(1);
}
console.log(`サイトの検証に成功しました（JavaScript ${jsFiles.length} ファイル、参照 ${html.match(refPattern)?.length ?? 0} 件）`);
