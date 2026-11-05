import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TASK_BUDGETS, budgetForTask, defaultLlmBudget, isTruncatedFinish, parseDialogueReply, truncatedRetryBudget } from '../src/llm.ts';
import { SAMPLING_FIELDS } from '../src/presets.ts';

test('v59 截断判定覆盖两家接口的写法', () => {
  assert.equal(isTruncatedFinish('length'), true);
  assert.equal(isTruncatedFinish('MAX_TOKENS'), true);
  assert.equal(isTruncatedFinish('max_tokens'), true);
  assert.equal(isTruncatedFinish('stop'), false);
  assert.equal(isTruncatedFinish(undefined), false);
});

test('v59 截断后的重试额度：至少翻倍、不低于 2400、封顶 32768', () => {
  assert.equal(truncatedRetryBudget(1200), 2400);
  assert.equal(truncatedRetryBudget(2400), 4800);
  assert.equal(truncatedRetryBudget(1024), 2400, '低于地板值也要抬到能写完一条');
  assert.equal(truncatedRetryBudget(30000), 32768);
  assert.equal(truncatedRetryBudget(undefined), 2400);
});

test('v94 灯下私语跟随统一额度（8000）', () => {
  assert.equal(DEFAULT_TASK_BUDGETS.whisper, undefined);
  assert.equal(DEFAULT_TASK_BUDGETS.news, undefined);
  assert.equal(budgetForTask(defaultLlmBudget(), 'whisper'), 8000);
});

test('v59 被截断的 JSON 只会解析出半条（这就是"已生成 1 条"却断在动作上的原因）', () => {
  const cut = '{"lines":[{"text":"报告所长～南十字路口的残烛样本已经打包封存好啦。","action":"单手抛接沉甸甸的';
  const lines = parseDialogueReply(cut, { maxLines: 3, perLine: 90, totalLimit: 300, actionLimit: 50 });
  assert.ok(lines.length === 1, `截断文本只洗出 ${lines.length} 条`);
  // 重试真正的判据是 finish，不是这段文本本身；这里只固定"能洗出东西"这个行为，
  // 免得有人误以为解析器能救回被砍掉的结尾。
  assert.ok(lines[0]!.text.length > 0);
});

test('v59 预设里「最大输出」的说明写明额度由输出预算决定、截断会自动重试', () => {
  const param = SAMPLING_FIELDS.find(entry => entry.key === 'openai_max_tokens');
  assert.ok(param, '找不到「最大输出」这一项');
  assert.match(param!.hint ?? '', /输出预算/);
  assert.match(param!.hint ?? '', /重试/);
});
