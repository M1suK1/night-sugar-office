import test from 'node:test';
import assert from 'node:assert/strict';

/** 输出预算存在 localStorage 里；node 里装一个内存替身，跑完还原。 */
const store = new Map<string, string>();
const globals = globalThis as { localStorage?: unknown };
const previous = globals.localStorage;
globals.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, String(value)); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
};
test.after(() => { globals.localStorage = previous; });

import type { PresetRuntime } from '../src/presets.ts';

const {
  BUDGET_MAX, BUDGET_MIN, BUDGET_UNIFIED_DEFAULT, DEFAULT_TASK_BUDGETS, LLM_BUDGET_TASKS,
  applyPresetApi, budgetForTask, defaultLlmBudget, loadLlmBudget, loadLlmSettings, resolveLlm,
  saveLlmBudget, saveLlmSettings, setLlmProvider, taskRuntime, updateLlmSlot,
} = await import('../src/llm.ts');

const CONFIG_KEY = 'night-sugar:llm-config';

function presetWithApi(api: Record<string, string | undefined>): PresetRuntime {
  return { api } as unknown as PresetRuntime;
}

function seedTwoSlots() {
  saveLlmSettings({
    provider: 'openai',
    openai: { endpoint: 'https://api.deepseek.com/v1', apiKey: 'sk-openai-demo', model: 'deepseek-chat', location: 'us-central1' },
    vertex: { endpoint: '', apiKey: '{"type":"service_account","project_id":"demo-proj"}', model: 'gemini-2.5-pro', location: 'asia-east1' },
  });
  store.set(CONFIG_KEY, JSON.stringify(loadLlmSettings()));
}

test('默认预算：统一 2048，重 JSON 任务各有更宽的默认口子', () => {
  const budget = defaultLlmBudget();
  assert.equal(budget.unified, BUDGET_UNIFIED_DEFAULT);
  assert.equal(budget.unified, 2048);
  assert.equal(budget.tasks.daily, 6000);
  assert.equal(budget.tasks.arc, 4000);
  assert.equal(budget.tasks.chat, undefined);
  assert.equal(DEFAULT_TASK_BUDGETS.chat, undefined);
  assert.equal(LLM_BUDGET_TASKS.length, 9);
});

test('未单独指定的任务跟随统一值，指定了就用自己的', () => {
  const budget = { unified: 1500, tasks: { daily: 7000 } };
  assert.equal(budgetForTask(budget, 'daily'), 7000);
  assert.equal(budgetForTask(budget, 'chat'), 1500);
  assert.equal(budgetForTask(budget, undefined), 1500);
});

test('没有预算记录时回落到默认值', () => {
  store.clear();
  const budget = loadLlmBudget();
  assert.equal(budget.unified, BUDGET_UNIFIED_DEFAULT);
  assert.equal(budget.tasks.daily, 6000);
});

test('存盘会夹到合法区间，非法单项直接丢掉', () => {
  saveLlmBudget({ unified: 10, tasks: { daily: 999999, chat: 0, battle: Number.NaN } });
  const budget = loadLlmBudget();
  assert.equal(budget.unified, BUDGET_MIN);
  assert.equal(budget.tasks.daily, BUDGET_MAX);
  assert.equal(budget.tasks.chat, undefined);
  assert.equal(budget.tasks.battle, undefined);
});

test('坏 JSON 不会把设置搞挂', () => {
  store.clear();
  store.set('night-sugar:llm-budget', '{ this is not json');
  const budget = loadLlmBudget();
  assert.equal(budget.unified, BUDGET_UNIFIED_DEFAULT);
});

test('taskRuntime 用预算覆盖预设自带的 maxTokens', () => {
  store.clear();
  saveLlmBudget({ unified: 1024, tasks: { daily: 5000 } });
  assert.equal(taskRuntime(undefined, 'chat').maxTokens, 1024);
  assert.equal(taskRuntime(undefined, 'daily').maxTokens, 5000);
  // 预算优先于预设：即便预设写着别的额度，运行时也以设置为准。
  saveLlmBudget({ unified: 800, tasks: {} });
  assert.equal(taskRuntime(undefined, 'daily').maxTokens, 800);
});

test('切默认接口不会把一份凭证抄进另一份', () => {
  store.clear();
  seedTwoSlots();
  const after = setLlmProvider('vertex');
  assert.equal(after.provider, 'vertex');
  assert.equal(after.openai.apiKey, 'sk-openai-demo');
  assert.equal(after.openai.model, 'deepseek-chat');
  assert.equal(after.vertex.apiKey.startsWith('{'), true);
  assert.equal(after.vertex.model, 'gemini-2.5-pro');
  // 切回来也还在
  const back = setLlmProvider('openai');
  assert.equal(back.provider, 'openai');
  assert.equal(back.vertex.model, 'gemini-2.5-pro');
});

test('改字段只落在当前这份槽位', () => {
  store.clear();
  seedTwoSlots();
  const next = updateLlmSlot('vertex', { model: 'gemini-2.0-flash' });
  assert.equal(next.vertex.model, 'gemini-2.0-flash');
  assert.equal(next.openai.model, 'deepseek-chat');
  assert.equal(next.openai.apiKey, 'sk-openai-demo');
  const patched = updateLlmSlot('openai', { endpoint: 'https://api.moonshot.cn/v1' });
  assert.equal(patched.openai.endpoint, 'https://api.moonshot.cn/v1');
  assert.equal(patched.vertex.endpoint, '');
});

test('预设自带接口时改走预设那一份，没填的沿用该份凭证', () => {
  store.clear();
  seedTwoSlots();
  const base = resolveLlm(loadLlmSettings(), 'openai');
  const toVertex = applyPresetApi(presetWithApi({ provider: 'vertex', model: 'gemini-2.5-flash' }), base, loadLlmSettings());
  assert.equal(toVertex.provider, 'vertex');
  assert.equal(toVertex.model, 'gemini-2.5-flash');
  assert.equal(toVertex.apiKey.startsWith('{'), true);
  assert.equal(toVertex.location, 'asia-east1');
  // 默认接口是 Vertex 时，预设指名 OpenAI 也能切回去
  const vertexBase = resolveLlm(setLlmProvider('vertex'), 'vertex');
  const toOpenai = applyPresetApi(presetWithApi({ provider: 'openai' }), vertexBase, loadLlmSettings());
  assert.equal(toOpenai.provider, 'openai');
  assert.equal(toOpenai.apiKey, 'sk-openai-demo');
  assert.equal(toOpenai.endpoint, 'https://api.deepseek.com/v1');
});

test('预设整套自带 endpoint 与密钥时优先于设置里的凭证', () => {
  store.clear();
  seedTwoSlots();
  const base = resolveLlm(loadLlmSettings(), 'openai');
  const own = applyPresetApi(presetWithApi({ endpoint: 'https://relay.example.com/v1', apiKey: 'relay-key', model: 'relay-model' }), base, loadLlmSettings());
  assert.equal(own.endpoint, 'https://relay.example.com/v1');
  assert.equal(own.apiKey, 'relay-key');
  assert.equal(own.model, 'relay-model');
  // 没指定接口的预设沿用默认那份
  const plain = applyPresetApi(undefined, base, loadLlmSettings());
  assert.equal(plain.endpoint, 'https://api.deepseek.com/v1');
  assert.equal(plain.apiKey, 'sk-openai-demo');
});
