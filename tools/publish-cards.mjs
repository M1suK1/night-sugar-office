#!/usr/bin/env node
/**
 * 把 data/cards 里的契约卡同步到 GitHub 的 cards 分支。
 *
 *   node tools/publish-cards.mjs
 *
 * 设计：cards 分支只放卡，且永远只有一条提交（每次同步 amend 后 force-push），
 * 这样仓库不会因为反复更新卡库而膨胀；main 分支保持纯代码。
 * 卡文件本身在 .gitignore 里，这里用 git add -f 强制加入。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const work = path.join(root, '.tmp', 'cards-publish');
const source = path.join(root, 'data', 'cards');
const remoteBranch = 'cards';
const localBranch = 'cards-sync';

const git = (args, cwd = root) => execFileSync('git', args, { cwd, stdio: 'inherit' });

if (!fs.existsSync(source)) {
  console.error('找不到 data/cards。');
  process.exit(1);
}

/** 本地是否已有这条分支；`rev-parse --verify` 在没有时会直接失败。 */
const hasBranch = (name) => {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

if (fs.existsSync(work)) git(['worktree', 'remove', '--force', work]);
// 每次同步都重建：上一轮留下的 cards-sync 会让 `checkout --orphan` 撞名失败。
// 分支只在本脚本里当发布载体，远端 origin/cards 才是要保留的那一份。
if (hasBranch(localBranch)) git(['branch', '-D', localBranch]);
git(['worktree', 'add', '--detach', work]);

try {
  git(['checkout', '--orphan', localBranch], work);
  git(['rm', '-rf', '.'], work);
  fs.rmSync(path.join(work, 'data'), { recursive: true, force: true });
  fs.mkdirSync(path.join(work, 'data', 'cards'), { recursive: true });
  let count = 0;
  for (const name of fs.readdirSync(source)) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    fs.copyFileSync(path.join(source, name), path.join(work, 'data', 'cards', name));
    count += 1;
  }
  fs.writeFileSync(path.join(work, 'README.md'), [
    '# 契约卡库',
    '',
    '这个分支只放游戏里可直接导入的契约卡（`data/cards/*.json`），和代码分支分开维护。',
    '',
    '- 下载任意 `.json`，在游戏里「契约卡库 → 导入」即可使用。',
    '- 更新：在本地跑 `node tools/publish-cards.mjs`，会把 `data/cards` 的最新内容同步过来。',
    '- 分支每次只保留一条提交，避免卡图反复更新撑大仓库。',
    '',
    `最近同步：${new Date().toISOString().slice(0, 10)}（${count} 张）`,
    '',
  ].join('\n'));
  git(['add', '-f', 'data/cards', 'README.md'], work);
  git(['commit', '-m', `cards: sync ${new Date().toISOString().slice(0, 10)} (${count} 张)`], work);
  git(['push', '--force', 'origin', `${localBranch}:${remoteBranch}`], work);
  console.log(`已同步 ${count} 张卡到 origin/${remoteBranch}。`);
} finally {
  git(['worktree', 'remove', '--force', work]);
}
