import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearResearchCache, normalizeResearchQuery, researchCharacter } from '../src/research.ts';
import { generateGirlProfile } from '../src/llm.ts';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearResearchCache();
});

const vertexConfig = { provider: 'vertex' as const, apiKey: 'AIzaTEST', model: 'gemini-2.5-pro', location: 'us-central1' };

function mockVertex(body: string, grounding = true) {
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.match(String(url), /aiplatform\.googleapis\.com/);
    sent.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
    return new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: body }] },
        finishReason: 'STOP',
        ...(grounding ? {
          groundingMetadata: {
            webSearchQueries: ['博丽灵梦 设定'],
            groundingChunks: [
              { web: { uri: 'https://example.com/reimu', title: '博丽灵梦 - 示例百科' } },
              { web: { uri: 'not-a-url', title: '坏链接' } },
            ],
          },
        } : {}),
      }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return sent;
}

test('联网考据：查询词会折叠空白并裁到 160 字', () => {
  assert.equal(normalizeResearchQuery('  博丽   灵梦  '), '博丽 灵梦');
  assert.equal(normalizeResearchQuery('x'.repeat(300)).length, 160);
});

test('联网考据：非 Vertex 接口直接说明不支持，不发请求', async () => {
  let called = false;
  globalThis.fetch = (async () => { called = true; throw new Error('should not call'); }) as typeof fetch;
  const result = await researchCharacter({ provider: 'openai', apiKey: 'k', model: 'm' }, '博丽灵梦');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /只支持 Vertex/);
  assert.equal(called, false);
});

test('联网考据：带 googleSearch、整理摘要、过滤坏来源，并缓存 30 分钟', async () => {
  const sent = mockVertex('· **要点一**：博丽的巫女。\n\n· 要点二：以符卡战斗。');
  const first = await researchCharacter(vertexConfig, '博丽灵梦');
  assert.equal(first.ok, true, first.ok ? '' : first.message);
  if (!first.ok) return;
  assert.equal(first.cached, false);
  assert.equal(first.data.summary, '· 要点一：博丽的巫女。\n\n· 要点二：以符卡战斗。');
  assert.deepEqual(first.data.sources, [{ title: '博丽灵梦 - 示例百科', uri: 'https://example.com/reimu' }]);
  assert.deepEqual(first.data.queries, ['博丽灵梦 设定']);
  assert.deepEqual((sent[0] as { tools?: unknown }).tools, [{ googleSearch: {} }]);

  const second = await researchCharacter(vertexConfig, '博丽灵梦');
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.cached, true);
  assert.equal(sent.length, 1, '同一条查询命中缓存，不再请求');
});

test('联网考据：模型没有给出正文时把 Vertex 的失败原样带回来', async () => {
  mockVertex('   ');
  const result = await researchCharacter(vertexConfig, '不存在的角色');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /没有返回文本内容/);
});

test('联网考据：资料会作为「只作考据」的参考写进角色起草提示词', async () => {
  const profile = {
    name: '灵梦', codename: '梦', title: '博丽的巫女', element: '星光系', archetype: '侦查',
    quote: '走吧。', goal: '守住博丽神社。', appearance: '红白巫女服。', personality: '直率。',
    outfitDescription: '红白两色的巫女服。', color: '#cc2244', focus: 'insight',
    skillIds: ['glimmer-spear', 'night-prayer', 'moon-phase'],
    traits: [
      { name: '直觉', description: '总能先一步察觉异样。', polarity: 'positive' },
      { name: '懒散', description: '没事的时候只想喝茶。', polarity: 'negative' },
      { name: '守序', description: '该做的事不会推给别人。', polarity: 'neutral' },
    ],
  };
  let sentText = '';
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    sentText = String(init?.body ?? '');
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(profile) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const result = await generateGirlProfile(
    { provider: 'openai', endpoint: 'https://mock.local/v1', apiKey: 'k', model: 'm' },
    undefined,
    '红白巫女',
    undefined,
    { summary: '· 博丽的巫女，用符卡战斗。', sources: [{ title: '示例百科', uri: 'https://example.com/reimu' }] },
  );
  assert.equal(result.ok, true, result.ok ? '' : result.message);
  assert.match(sentText, /【联网资料（只作考据，可能不准确）】/);
  assert.match(sentText, /博丽的巫女，用符卡战斗/);
  assert.match(sentText, /以立绘与玩家为准/);
});
