import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { storylineHistoryText } from '../src/girlDossier.ts';
import { storyMemoryAppendix } from '../src/llm.ts';
import { presetRuntime } from '../src/presets.ts';
import type { Storyline } from '../src/types.ts';

/**
 * v233：角色对话 / 灯下私语的【她的过往】——
 * 不再复述「已走过」的节点，改成带出结局那一段的结局描述，且不许截断。
 */

function doneStory(girlId: string, endingSummary?: string): Storyline {
  return {
    id: 's-1', girlId, title: '双针重合之刻', tone: '', stage: 3, status: 'done',
    createdAt: '2026-01-01T00:00:00.000Z', day: 12, source: 'llm', slot: 1,
    premise: '恪守对称仪轨的贵族剑士在长夜里迎来了市役所的清算通牒，当名门的虚衔被冷雾剥落，她颤抖的剑尖能否在所长身侧找回真正的平衡？',
    beats: [
      { id: 'b1', index: 0, title: '钟楼回廊的正逆针', summary: '', scene: '', hook: '', status: 'done', choices: [{ id: 'c1', label: '逆着指针走', intent: '', effect: {} }], resolvedChoiceId: 'c1' },
      { id: 'b2', index: 1, title: '冷雾里的通牒', summary: '', scene: '', hook: '', status: 'done', choices: [] },
    ],
    ending: '双正之心',
    endingSummary,
  } as unknown as Storyline;
}

test('v233 【她的过往】：写清段号、标题与前提，不再罗列已走过的节点', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  state.storylines = [doneStory(girl.id, '她终于把两枚指针摆回同一个刻度。')];
  const text = storylineHistoryText(state, girl, 3);
  assert.ok(text.includes('第 1 段「双针重合之刻」（已完结）'));
  assert.ok(text.includes('恪守对称仪轨的贵族剑士'));
  assert.equal(text.includes('已走过'), false, '不再复述走过的节点');
  assert.equal(text.includes('钟楼回廊的正逆针'), false, '已走过的节点标题不该出现');
  assert.ok(text.includes('结局：双正之心'));
});

test('v233 【她的过往】：结局描述整段带进来，长文也不截断', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const summary = '她把两枚指针并拢，听见齿轮在深处咬合。'.repeat(120);
  state.storylines = [doneStory(girl.id, summary)];
  const text = storylineHistoryText(state, girl, 3);
  assert.ok(text.includes('结局描述：'), '要有结局描述');
  assert.ok(text.includes(summary), '结局描述必须完整，一个字都不能少');
});

test('v233 【她的过往】：老存档没有结局描述时，退回蓝图里 end 节点写的 summary', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const story = doneStory(girl.id, undefined);
  state.storylines = [{
    ...story,
    graph: {
      version: 1,
      entry: 'n1',
      edges: [],
      nodes: [
        { id: 'n1', kind: 'start', title: '开场', data: { kind: 'start' } },
        { id: 'n2', kind: 'end', title: '收束', data: { kind: 'end', ending: '双正之心', summary: '两枚针最终摆向同一个方向。' } },
      ],
    },
  } as unknown as Storyline];
  const text = storylineHistoryText(state, girl, 3);
  assert.ok(text.includes('结局描述：两枚针最终摆向同一个方向。'));
});

test('v233 对话/私语兜底：预设里没写【她的过往】时，代码补一段故事线记忆', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  state.storylines = [doneStory(girl.id, '她终于不用再数着秒针呼吸。')];

  const bare = presetRuntime(undefined);
  const appendix = storyMemoryAppendix(bare, state, girl);
  assert.ok(appendix.startsWith('【她的过往】'));
  assert.ok(appendix.includes('结局：双正之心'));
  assert.ok(appendix.includes('她终于不用再数着秒针呼吸。'));

  const withMacro = {
    ...bare,
    entries: [{ id: 'chat-heroine', name: '对话·她是谁', role: 'system', enabled: true, scope: 'chat', content: '【她的过往】\n{{history.storylines}}' }],
  } as unknown as typeof bare;
  assert.equal(storyMemoryAppendix(withMacro, state, girl), '', '预设已经写了就别重复塞一遍');
});
