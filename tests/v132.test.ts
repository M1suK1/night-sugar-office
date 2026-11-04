import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { generateStoryTurn } from '../src/llm.ts';
import { presetRuntime, type ChatPreset } from '../src/presets.ts';
import { contractPrompts } from '../src/promptContracts.ts';
import { arcTurnContract } from '../src/promptSections.ts';
import type { CharacterEvent } from '../src/types.ts';

/** 把预设里的剧情续写契约改成玩家版，看真正发出去的请求长什么样。 */
function presetWithContract(content: string): ChatPreset {
  return {
    id: 'p-turn', name: '改过的剧情', builtin: false, settings: {}, regex: [],
    prompts: [{
      id: 'arc:turn', name: '蓝图续写 · 结构契约', content,
      defaultContent: arcTurnContract(), role: 'system', enabled: true, contract: true, scope: 'arc',
    }],
  } as unknown as ChatPreset;
}

function event(): CharacterEvent {
  const state = createInitialState();
  return {
    id: 'ev-1', girlId: state.girls[0]!.id, title: '雨夜的便利店', hook: '她在门口等你',
    scenes: [], stage: 0, status: 'active', day: 14, source: 'template', badge: false,
    mode: 'session', opening: '雨下得很大，她把伞收起来靠在门边。', turns: [], cast: [state.girls[0]!.id],
  } as CharacterEvent;
}

test('v131 续写请求里发的是玩家改过的契约，而且动态正文还在', async () => {
  const original = globalThis.fetch;
  let system = '';
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    // Vertex 把系统提示放在 systemInstruction，OpenAI 兼容端点放在 messages：两处都收。
    system = String(init?.body ?? '');
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ narration: '雨声盖住了她的呼吸。'.repeat(60), lines: [], options: ['你伸手替她擦掉脸上的雨'], bond: 0 }) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const state = createInitialState();
    const result = await generateStoryTurn(
      { endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock', provider: 'vertex' } as never,
      state, event(), '我把伞递给她。',
      presetRuntime(presetWithContract('【玩家版契约】每轮至少 900 字，结尾必须留一个未回答的问题。')),
    );
    assert.equal(result.ok, true, result.ok ? '' : result.message);
  } finally {
    globalThis.fetch = original;
  }
  const ids = contractPrompts().map(entry => entry.id);
  assert.ok(ids.includes('arc:turn'));
  assert.ok(system.includes('【玩家版契约】'), '预设里改过的契约必须真的发出去');
  assert.ok(!system.includes('after 必填'), '默认契约不该同时出现');
  assert.ok(system.includes('【这一段剧情】'), '动态正文不能被契约覆盖掉');
  assert.ok(system.includes('我把伞递给她。'), '所长这一句也要在');
});
