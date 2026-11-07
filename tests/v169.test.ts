import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGirlProfile } from '../src/llm.ts';
import { girlSkillPool, isPassiveSkill, rollPassiveSkill } from '../src/skills.ts';
import { mulberry32 } from '../src/content/archetypes.ts';

const ACTIVE_THREE = ['glimmer-spear', 'peach-ward', 'starlight-fall'];

test('v169 起草掷骰：三成带被动，带与不带都出现，永不超一条', () => {
  let withPassive = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const ids = rollPassiveSkill(ACTIVE_THREE, '赤焰系', mulberry32(seed));
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    const passives = ids.filter(isPassiveSkill);
    assert.ok(passives.length <= 1, `seed ${seed} 带了 ${passives.length} 条被动`);
    if (passives.length) {
      withPassive += 1;
      const skill = girlSkillPool().find(entry => entry.id === passives[0]);
      assert.ok(skill?.school === '赤焰系' || skill?.school === '通用', `${passives[0]} 不属于赤焰系或通用`);
    }
  }
  assert.ok(withPassive > 60 && withPassive < 180, `400 次里带被动 ${withPassive} 次，偏离三成`);
});

test('v169 不带被动时原样保留，带被动时先换掉基础技能', () => {
  assert.deepEqual(rollPassiveSkill(ACTIVE_THREE, '星光系', () => 0.9), ACTIVE_THREE);

  // 第一次 0.1 < 0.3 触发；第二次 0.1 < 0.6 走本流派；第三次 0.1 选第一条。
  const rolled = rollPassiveSkill(ACTIVE_THREE, '星光系', () => 0.1);
  assert.equal(rolled.length, 3);
  assert.ok(isPassiveSkill(rolled[0]), '基础技能那一格被换掉');
  assert.deepEqual(rolled.slice(1), ['peach-ward', 'starlight-fall']);

  // 已经带被动就不再叠第二条。
  assert.deepEqual(rollPassiveSkill(rolled, '星光系', () => 0), rolled);
});

test('v169 自定义起草的提示词不再列被动，只让模型挑主动', async () => {
  const body = await captureDraftRequest();
  assert.ok(!/passive-/.test(body), '提示词里不该出现被动 id');
  assert.match(body, /三个主动技能/);
  assert.ok(!/最多 1 条被动/.test(body), '不该再提示「最多 1 条被动」');
});

test('v169 模型塞进来的被动会被丢掉，最终仍是最多一条', async () => {
  const result = await draftWith(['passive-ember', 'glimmer-spear', 'peach-ward']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.skillIds.length, 3);
  assert.equal(new Set(result.data.skillIds).size, 3);
  assert.ok(result.data.skillIds.filter(isPassiveSkill).length <= 1);
  assert.ok(result.data.skillIds.every(id => girlSkillPool().some(skill => skill.id === id)));
});

async function captureDraftRequest(): Promise<string> {
  let body = '';
  await mockDraft(['glimmer-spear', 'peach-ward', 'starlight-fall'], raw => { body = raw; });
  return body;
}

async function draftWith(skillIds: string[]): Promise<Awaited<ReturnType<typeof generateGirlProfile>>> {
  return mockDraft(skillIds);
}

async function mockDraft(skillIds: string[], onRequest?: (body: string) => void) {
  const original = globalThis.fetch;
  const profile = {
    name: '纸灯', codename: '折光', title: '把夜色折成小船的人', element: '星光系', archetype: '治愈',
    quote: '我会把灯留给你。', goal: '找到愿意收留纸船的人。', appearance: '短发，发梢有折痕。',
    personality: '安静，喜欢折纸。', outfitDescription: '宽大的值夜制服。', focus: 'empathy', skillIds,
  };
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    onRequest?.(String(init?.body ?? ''));
    return new Response(JSON.stringify({
      choices: [{ message: { content: [{ type: 'text', text: JSON.stringify(profile) }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    return await generateGirlProfile({ endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock' });
  } finally {
    globalThis.fetch = original;
  }
}
