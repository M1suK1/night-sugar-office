import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { planForSlot, priorSegmentBrief, setPlanForSlot, storyPlanTemplate } from '../src/storyplan.ts';
import { generateStoryBlueprint } from '../src/llm.ts';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';
import type { Storyline } from '../src/types.ts';

/** 造一条「已经走完的第 1 段」，带结局。 */
function doneStoryline(girlId: string, ending: string): Storyline {
  return {
    id: `story-${girlId}-1`, girlId, slot: 1, status: 'done', stage: 3, title: '旧钟楼的终幕狂言',
    premise: '她在旧钟楼里找到一段被抹掉的录音。', ending,
    beats: [{ id: 'b1', index: 0, title: '午夜的恶作剧筹备', summary: '', scene: '', hook: '', choices: [], status: 'done' }],
  } as unknown as Storyline;
}

const plan = (title: string) => storyPlanTemplate(title, `${title}的前提`);

test('v138 三段各一张蓝图：旧字段算第 1 段', () => {
  const girl = { storyPlan: plan('第一段'), storyPlans: [null, plan('第二段'), null] } as never;
  assert.equal(planForSlot(girl, 1)?.title, '第一段', '没有 storyPlans[0] 时回落到 storyPlan');
  assert.equal(planForSlot(girl, 2)?.title, '第二段');
  assert.equal(planForSlot(girl, 3), undefined, '第 3 段没写就是没有');
});

test('v138 写第 1 段会同步 storyPlan 别名，写第 2 段不会', () => {
  const girl: { storyPlan?: ReturnType<typeof plan>; storyPlans?: (ReturnType<typeof plan> | null)[] } = {};
  setPlanForSlot(girl, 1, plan('一'));
  assert.equal(girl.storyPlan?.title, '一');
  setPlanForSlot(girl, 2, plan('二'));
  assert.equal(girl.storyPlan?.title, '一', '第 1 段别名不受第 2 段影响');
  assert.equal(girl.storyPlans?.[1]?.title, '二');
});

test('v138 没有第 2 段蓝图时不许开场，并说清楚原因', () => {
  const base = createInitialState();
  const girl = base.girls[0]!;
  const state = { ...base, storylines: [doneStoryline(girl.id, '狂欢盛宴')], girls: base.girls.map(item => item.id === girl.id ? { ...item, bond: 60, storyPlan: plan('第一段') } : item) };
  const result = act(state, { type: 'startStoryline', girlId: girl.id });
  assert.equal(result.ok, false);
  assert.match(result.message, /第 2 段/);
});

test('v138 第 2 段用自己那张蓝图开场', () => {
  const base = createInitialState();
  const girl = base.girls[0]!;
  const state = {
    ...base,
    storylines: [doneStoryline(girl.id, '狂欢盛宴')],
    girls: base.girls.map(item => item.id === girl.id
      ? { ...item, bond: 60, storyPlan: plan('第一段'), storyPlans: [plan('第一段'), plan('第二段'), null] }
      : item),
  };
  const result = act(state, { type: 'startStoryline', girlId: girl.id });
  assert.equal(result.ok, true, result.message);
  const started = result.state.storylines.find(story => story.status === 'active')!;
  assert.equal(started.slot, 2);
  assert.equal(started.title, '第二段', '不能用第 1 段的图重跑');
});

test('v138 上一段的结局会写进简报', () => {
  const state = { storylines: [doneStoryline('g1', '狂欢盛宴')] };
  const brief = priorSegmentBrief(state as never, 'g1', 2);
  assert.match(brief, /必须承接第 1 段/);
  assert.match(brief, /狂欢盛宴/);
  assert.match(brief, /不能复位|不要重演/);
  assert.equal(priorSegmentBrief(state as never, 'g1', 1), '', '第 1 段没有「上一段」');
});

test('v138 生成第 2 段蓝图时，请求里带着上一段的结局', async () => {
  const original = globalThis.fetch;
  const systems: string[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    systems.push(String(init?.body ?? ''));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        title: '第二段', premise: '她带着那卷录音离开旧钟楼。', tone: '克制',
        nodes: [{ id: 'n1', kind: 'start', title: '开始', data: { kind: 'start' } }, { id: 'n2', kind: 'end', title: '结束', data: { kind: 'end', summary: '收束' } }],
        edges: [{ from: 'n1', fromPort: 'out', to: 'n2' }],
      }) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const base = createInitialState();
    const girl = base.girls[0]!;
    const state = { ...base, storylines: [doneStoryline(girl.id, '狂欢盛宴')] };
    const result = await generateStoryBlueprint(
      { endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock', provider: 'vertex' } as never,
      girl, undefined, undefined, state, { slot: 2 },
    );
    // 校验会嫌这份桩数据节点太少（真实生成时要 8 个以上节点），这里只关心发出去的提示词。
    void result;
  } finally {
    globalThis.fetch = original;
  }
  const joined = systems.join('\n');
  assert.ok(systems.length >= 1, '至少要发出一次请求');
  assert.match(joined, /必须承接第 1 段/, '提示词要说明这是续写');
  assert.match(joined, /狂欢盛宴/, '要带上上一段的结局');
});

test('v138 契约卡导出/导入保留三段蓝图', () => {
  const base = createInitialState();
  const girl = { ...base.girls[0]!, storyPlans: [plan('一'), plan('二'), null] as (ReturnType<typeof plan> | null)[] };
  const card = parseGirlCard(JSON.stringify(buildGirlCard(girl, base)));
  assert.equal(card.ok, true);
  if (!card.ok) return;
  assert.equal(card.card.girl.storyPlans?.[0]?.title, '一');
  assert.equal(card.card.girl.storyPlans?.[1]?.title, '二');
  assert.equal(card.card.girl.storyPlans?.[2] ?? null, null);
});
