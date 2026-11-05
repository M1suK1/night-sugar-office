import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TASK_BUDGETS, budgetForTask, defaultLlmBudget, extractJsonObject, incidentEntriesFrom } from '../src/llm.ts';

const entry = (title: string, category = 'decision') => ({ category, title, body: '桥头的冷藏货卡封印开裂，市役所限四十分钟内处理。', options: [] });

test('v55 截断的回复不会滑进内层对象：要么补齐最外层，要么当没给出 JSON', () => {
  const cut = '{"entries":[{"category":"decision","title":"桥头的失控货卡","options":[{"label":"执行指令冲滩","hint":"保秩序"';
  // v122 起：只差收尾括号时按括号栈补齐，仍然必须保留最外层（entries），不能滑进内层的选项对象。
  const salvaged = extractJsonObject(cut);
  assert.ok(salvaged, '只差收尾的内容会被补齐');
  assert.ok(Array.isArray(salvaged!.entries), '补齐后必须还是最外层结构');
  assert.equal(extractJsonObject('{"entries":[{"category":'), null, '截在键名中间就放弃');
  const complete = '{"entries":[{"category":"decision","title":"桥头的失控货卡","options":[]}]}';
  assert.deepEqual(extractJsonObject(complete), { entries: [{ category: 'decision', title: '桥头的失控货卡', options: [] }] });
  assert.deepEqual(extractJsonObject('```json\n{"entries":[]}\n```'), { entries: [] }, '代码块照样能取');
});

test('v55 批量事件容忍换壳子：entries / incidents / data.entries / 单条对象', () => {
  const one = entry('桥头的封锁线');
  assert.deepEqual(incidentEntriesFrom({ entries: [one] }), [one]);
  assert.deepEqual(incidentEntriesFrom({ incidents: [one, entry('巡夜税')] }).length, 2, 'incidents 这个壳子也认');
  assert.deepEqual(incidentEntriesFrom({ items: [one] }), [one]);
  assert.deepEqual(incidentEntriesFrom({ data: { entries: [one] } }), [one], '包在 data 里也认');
  assert.deepEqual(incidentEntriesFrom({ ...one, category: 'report' }), [{ ...one, category: 'report' }], '只给一条对象时当成一条');
  assert.deepEqual(incidentEntriesFrom({ entries: [null, 3, 'x', one] }), [one], '非对象条目直接丢掉');
  assert.deepEqual(incidentEntriesFrom(null), []);
  assert.deepEqual(incidentEntriesFrom({}), []);
  assert.deepEqual(incidentEntriesFrom({ label: '执行指令', hint: '保秩序' }), [], '只剩一个选项对象时不算事件');
});

test('v55 突发事件有独立额度，不再共用 2048 把三条事件写断', () => {
  // v94：统一值抬到 8000 之后，突发事件与新闻不再单独占额度，跟随统一值。
  assert.equal(DEFAULT_TASK_BUDGETS.incident, undefined);
  assert.equal(DEFAULT_TASK_BUDGETS.news, undefined);
  assert.equal(budgetForTask(defaultLlmBudget(), 'incident'), 8000);
  assert.equal(budgetForTask(defaultLlmBudget(), 'news'), 8000);
});
