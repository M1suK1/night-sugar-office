import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { BALANCE_FIELDS, DEFAULT_BALANCE, sanitizeBalance } from '../src/balance.ts';
import { localCityNews, newsIsStale, sanitizeCityNews } from '../src/cityNews.ts';
import { districts } from '../src/districts.ts';
import { DEFAULT_PROMPTS, PROMPT_SCOPES, PROMPT_TASK_SCOPES } from '../src/presets.ts';
import { SECTION_PROMPTS, newsContract } from '../src/promptSections.ts';

test('v50 数值规则里有城市新闻开关，默认开着且只有 0 / 1 两档', () => {
  assert.equal(DEFAULT_BALANCE.cityNewsEnabled, 1);
  const field = BALANCE_FIELDS.find(item => item.key === 'cityNewsEnabled');
  assert.ok(field, '数值页要能看到这个开关');
  assert.equal(field?.kind, 'toggle');
  assert.equal(field?.group, '城市新闻');
  assert.equal(sanitizeBalance({}).cityNewsEnabled, 1, '旧配置没有这一项时按开处理');
  assert.equal(sanitizeBalance({ cityNewsEnabled: 0 }).cityNewsEnabled, 0);
  assert.equal(sanitizeBalance({ cityNewsEnabled: 7 }).cityNewsEnabled, 1, '越界值夹回 0 / 1');
  assert.equal(sanitizeBalance({ cityNewsEnabled: -3 }).cityNewsEnabled, 0);
});

test('v50 本地快讯：只讲当前存档里真的发生的事', () => {
  const state = createInitialState();
  state.reputation = 24;
  state.pollution = { ...state.pollution, candy: 88 };
  const news = localCityNews(state);
  assert.equal(news.source, 'rule');
  assert.equal(news.day, state.day);
  assert.ok(news.items.length >= 3 && news.items.length <= 4, '3–4 条');
  for (const item of news.items) {
    assert.ok(['faction', 'pollution', 'stability', 'street'].includes(item.tone));
    assert.ok(item.text.length > 8 && item.text.length <= 90);
  }
  const pollutionLine = news.items.find(item => item.tone === 'pollution');
  assert.ok(pollutionLine?.text.includes(districts.candy.name), '要写出最脏的辖区');
  assert.ok(pollutionLine?.text.includes('88'), '要写出现场读数');
  const stabilityLine = news.items.find(item => item.tone === 'stability');
  assert.ok(stabilityLine?.text.includes('24'), '要写当前安定度');
  assert.ok(stabilityLine?.text.includes('宵禁') || stabilityLine?.text.includes('告示'), '低安定度要写出城市的反应');
});

test('v50 播报清洗：坏条目丢掉、空 tone 回落街头、没有内容就整条不留', () => {
  const clean = sanitizeCityNews({
    headline: '超长标题'.repeat(10),
    items: [
      { text: '灯亮着，回收车绕过了糖街。', tone: 'pollution' },
      { text: '   ', tone: 'faction' },
      { text: '有人在排水沟里放了花。', tone: '乱写' },
      'not-an-object',
    ],
  }, 7);
  assert.ok(clean);
  assert.equal(clean?.day, 7);
  assert.equal(clean?.items.length, 2, '空文本与非对象都要丢掉');
  assert.equal(clean?.items[1]?.tone, 'street', '认不出的 tone 回落街头');
  assert.ok((clean?.headline.length ?? 0) <= 40, '标题要截到 40 字内');
  assert.equal(sanitizeCityNews({ items: [] }, 7), undefined);
  assert.equal(sanitizeCityNews(null, 7), undefined);
});

test('v50 换日就要重写：当日不算过期，隔夜或空播报算过期', () => {
  const state = createInitialState();
  const news = localCityNews(state);
  assert.equal(newsIsStale(news, state.day), false);
  assert.equal(newsIsStale(news, state.day + 1), true);
  assert.equal(newsIsStale(undefined, state.day), true);
  assert.equal(newsIsStale({ ...news, items: [] }, state.day), true);
});

test('v50 播种报：存进存档、可清空，读档字段是可选的', () => {
  const state = createInitialState();
  assert.equal(state.cityNews, undefined, '新档默认没有播报');
  const news = localCityNews(state);
  const saved = act(state, { type: 'setCityNews', news });
  assert.equal(saved.ok, true);
  assert.equal(saved.state.cityNews?.headline, news.headline);
  assert.equal(saved.state.cityNews?.items.length, news.items.length);
  const cleared = act(saved.state, { type: 'setCityNews', news: null });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.state.cityNews, undefined);
  const dirty = act(state, { type: 'setCityNews', news: { ...news, items: [{ text: '', tone: 'street' }] } });
  assert.equal(dirty.state.cityNews, undefined, '洗不出内容时不留半条');
});

test('v50 预设里多了城市新闻这一档：词条、分区与契约都在', () => {
  assert.ok(PROMPT_TASK_SCOPES.includes('news'));
  assert.ok(PROMPT_SCOPES.some(scope => scope.id === 'news'));
  assert.ok(DEFAULT_PROMPTS.some(entry => entry.id === 'news' && entry.scope === 'news'));
  assert.ok(SECTION_PROMPTS.some(entry => entry.id === 'nw-brief' && entry.scope === 'news'));
  const brief = SECTION_PROMPTS.find(entry => entry.id === 'nw-brief')!.content;
  for (const macro of ['{{night}}', '{{factions}}', '{{districts}}', '{{hostility}}', '{{council}}']) {
    assert.ok(brief.includes(macro), `分区里要带 ${macro}`);
  }
  const contract = newsContract();
  assert.ok(contract.includes('"headline"') && contract.includes('faction|pollution|stability|street'));
});
