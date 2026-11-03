import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 提示词字面量的「只减不增」闸门。
 *
 * 全部提示词都应该住在 `promptSections.ts` / `promptContracts.ts` / `promptMacros.ts` 里，
 * 这样设置界面能看到、能改。生成器里还剩下的几段正在搬，这里把当前数量钉住：
 * 以后谁再往生成器里写提示词，测试就会红；搬完一处，把 BUDGET 改小即可。
 */
const FILES = ['src/llm.ts', 'src/llm-night.ts', 'src/nightSpec.ts'];
const PATTERNS = [/只输出一个 JSON 对象/, /请写下/, /请接着写/, /写她此刻发给所长/, /【回复格式】/, /不要 Markdown 代码块/];
const BUDGET = 7;

function hits(): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n').forEach((line, index) => {
      if (PATTERNS.some(pattern => pattern.test(line))) found.push(`${file}:${index + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  return found;
}

test('v65 生成器里剩下的提示词字面量只减不增', () => {
  const found = hits();
  assert.ok(found.length <= BUDGET, `字面量应 ≤ ${BUDGET} 处，现在 ${found.length} 处，请搬到 promptSections.ts：\n${found.join('\n')}`);
  assert.equal(found.length, BUDGET, `搬完了一处就把 BUDGET 改成 ${found.length}：\n${found.join('\n')}`);
});

test('v65 该住进 promptSections / promptContracts 的都已经在里面', async () => {
  const sections = await import('../src/promptSections.ts');
  const contracts = await import('../src/promptContracts.ts');
  const names = ['dialogueContract', 'incidentBatchContract', 'outfitContract', 'newsContract', 'battleContract', 'storylineContract', 'arcContract', 'arcOpeningContract', 'arcTurnContract', 'whisperUserHint', 'eventUserHint', 'arcUserHint'];
  for (const name of names) assert.equal(typeof (sections as Record<string, unknown>)[name], 'function', `promptSections 缺少 ${name}`);
  assert.ok(contracts.contractPrompts().length >= 9, '契约词条应当覆盖主要任务');
});
