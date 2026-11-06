import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from '../src/game.ts';
import { createInitialState } from '../src/game.ts';
import type { CityNews, FactionRoster, GameState } from '../src/types.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { newsCastPool, newsIsStale, pickNewsGuests, pickNewsHost, sanitizeCityNews } from '../src/cityNews.ts';
import { localCityNews } from '../src/cityNewsLocal.ts';

const leader = customLeaderOf('witch', subjectOfCustom({
  id: 'L1', name: '青灯', factionTag: 'witch', level: 10, color: '#8a7bd6',
  portrait: '', stats: { magic: 70, insight: 62, agility: 55, empathy: 66 }, skillIds: [],
  title: '蚀月祭司', quote: '这一夜归我管。',
}));
const mate = customGirlOf('witch', subjectOfCustom({
  id: 'M1', name: '纸鸢', factionTag: 'witch', level: 8, color: '#8a7bd6',
  portrait: '', stats: { magic: 55, insight: 60, agility: 58, empathy: 62 }, skillIds: [],
  title: '提灯人', quote: '灯我来提。', codename: '纸鸢',
}));

const empty = (): FactionRoster => ({ leaderId: '', memberIds: [] });

function stateWith(): GameState {
  const base = createInitialState();
  return {
    ...base,
    customFactionLeaders: [leader],
    customFactionGirls: [mate],
    factionRoster: { association: empty(), government: empty(), witch: { leaderId: leader.id, memberIds: [mate.id] } },
  };
}

test('v167 访谈：主持人默认按日号固定，读档不会换人', () => {
  const state = stateWith();
  const first = pickNewsHost(state)!;
  const again = pickNewsHost({ ...state, cityNews: undefined })!;
  assert.equal(first.id, again.id);
  assert.ok(newsCastPool(state).some(person => person.id === first.id));
});

test('v167 访谈：玩家指定的主持人优先，人不在场时自动退回按日号选', () => {
  const state = stateWith();
  const pinned = pickNewsHost({ ...state, newsHostId: leader.id })!;
  assert.equal(pinned.id, leader.id);
  assert.equal(pinned.title, '月蚀庭首领');
  const ghost = pickNewsHost({ ...state, newsHostId: 'nobody' })!;
  assert.notEqual(ghost.id, 'nobody');
});

test('v167 访谈：嘉宾不会和主持人重复，最多两位', () => {
  const state = stateWith();
  const host = pickNewsHost(state)!;
  const guests = pickNewsGuests(state, host.id);
  assert.ok(guests.length <= 2);
  assert.ok(guests.every(guest => guest.id !== host.id));
  assert.equal(new Set(guests.map(guest => guest.id)).size, guests.length);
});

test('v167 访谈：本地兜底也有对话，且说话人都在名单里', () => {
  const news = localCityNews(stateWith(), 20);
  assert.ok(news.lines && news.lines.length >= 3, '至少要有主持人开场与收束');
  assert.ok(news.host, '要有主持人');
  const known = new Set([news.host!.id, ...(news.guests ?? []).map(person => person.id)]);
  for (const line of news.lines!) {
    assert.ok(known.has(line.speakerId), `${line.speakerName} 不在今晚的名单里`);
    assert.ok(line.text.length > 0);
  }
});

test('v167 访谈：旧存档只有 items 也能读，不会被当成坏数据', () => {
  const legacy = sanitizeCityNews({
    day: 15, headline: '旧播报',
    items: [{ text: '三条老快讯', tone: 'street' }],
    source: 'rule',
  }, 15);
  assert.ok(legacy);
  assert.equal(legacy!.lines, undefined);
  assert.equal(legacy!.host, undefined);
  assert.equal(legacy!.items.length, 1);
});

test('v167 访谈：模型编造的人说话会被丢掉，只留名单里的人', () => {
  const host = { id: 'L1', name: '青灯', title: '月蚀庭首领', faction: 'witch' as const };
  const news = sanitizeCityNews({
    day: 16, headline: '夜里的节目',
    host,
    guests: [{ id: 'M1', name: '纸鸢', title: '月蚀庭随从', faction: 'witch' }],
    lines: [
      { speakerId: 'L1', text: '今晚先谈污染。' },
      { speakerId: 'ghost', text: '我是编出来的人。' },
      { speakerId: 'M1', text: '那条街我熟。' },
    ],
    items: [{ text: '要闻一条', tone: 'pollution' }],
  }, 16);
  assert.ok(news);
  assert.equal(news!.lines!.length, 2, '编出来的那个人要被丢掉');
  assert.deepEqual(news!.lines!.map(line => line.speakerId), ['L1', 'M1']);
  assert.equal(news!.lines![1]!.speakerName, '纸鸢');
});

test('v167 换主持人：写进存档并作废当晚那档', () => {
  const state = stateWith();
  const withNews: GameState = { ...state, cityNews: localCityNews(state, state.day) };
  const result = act(withNews, { type: 'setNewsHost', girlId: leader.id });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.newsHostId, leader.id);
  assert.equal(result.state.cityNews, undefined, '换了主持人，旧节目作废');
  const rejected = act(withNews, { type: 'setNewsHost', girlId: 'nobody' });
  assert.equal(rejected.ok, false);
});

test('v167 过期判定：换日要重写，同一日有内容就不再重写', () => {
  const news: CityNews = localCityNews(stateWith(), 18);
  assert.equal(newsIsStale(news, 18), false);
  assert.equal(newsIsStale(news, 19), true);
  assert.equal(newsIsStale(undefined, 19), true);
});
