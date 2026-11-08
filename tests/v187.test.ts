import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { DEFAULT_BALANCE, clearBalanceCache, saveBalance } from '../src/balance.ts';
import { districts } from '../src/districts.ts';
import { mergeDistrictEffects, pollutionEffect, pollutionForecast } from '../src/pollution.ts';
import { factionEffect } from '../src/territories.ts';
import { missionSnapshot } from '../src/rules/missions.ts';
import { WAVE_AT, absoluteMinutes } from '../src/shift.ts';
import {
  WEATHERS, WEATHER_ORDER, waveOf, weatherAt, weatherEffect, weatherForSpawn, weatherOf, weatherPrompt, nextWeather,
} from '../src/weather.ts';

test('v187 三段天气跟着营业夜走，00:00–02:00 仍算第三段', () => {
  assert.equal(waveOf(20 * 60), 0);
  assert.equal(waveOf(21 * 60 + 59), 0);
  assert.equal(waveOf(22 * 60), 1);
  assert.equal(waveOf(23 * 60 + 59), 1);
  assert.equal(waveOf(24 * 60), 2);
  assert.equal(waveOf(25 * 60 + 30), 2);
  assert.equal(waveOf(26 * 60), WAVE_AT.length - 1);
  assert.equal(waveOf(3 * 60), WAVE_AT.length - 1, '营业时间之外也要落在一段上，不能为负');
  assert.equal(weatherAt(9, 25 * 60 + 30), weatherOf(9, 2));
});

test('v187 同一天同一段永远是同一种天气', () => {
  for (let day = 1; day <= 60; day += 1) {
    for (let wave = 0; wave < WAVE_AT.length; wave += 1) {
      const first = weatherOf(day, wave);
      assert.ok(WEATHER_ORDER.includes(first));
      for (let repeat = 0; repeat < 4; repeat += 1) assert.equal(weatherOf(day, wave), first);
    }
  }
  // 不被其它数值牵动：天气只看 day 与段号。
  const state = createInitialState();
  const before = weatherAt(state.day, state.minutes);
  state.gold += 9999;
  state.reputation = Math.max(0, state.reputation - 40);
  assert.equal(weatherAt(state.day, state.minutes), before);
});

test('v187 六种天气都会出现，薄雾占多数', () => {
  const counts = new Map<string, number>();
  for (let day = 1; day <= 300; day += 1) {
    for (let wave = 0; wave < WAVE_AT.length; wave += 1) {
      const id = weatherOf(day, wave);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  for (const id of WEATHER_ORDER) assert.ok((counts.get(id) ?? 0) > 0, `${id} 从没出现过`);
  const clear = counts.get('clear') ?? 0;
  for (const id of WEATHER_ORDER) {
    if (id === 'clear') continue;
    assert.ok(clear > (counts.get(id) ?? 0), `薄雾应当比 ${id} 更常见`);
  }
});

test('v187 薄雾没有修正，其它天气的修正都是小量', () => {
  assert.deepEqual(weatherEffect('clear'), {});
  for (const id of WEATHER_ORDER) {
    if (id === 'clear') continue;
    const effect = weatherEffect(id);
    assert.ok(Object.keys(effect).length > 0, `${id} 应当有修正`);
    for (const value of Object.values(effect)) assert.ok(Math.abs(value) <= 12, `${id} 的单项目标不应超过 12`);
  }
});

test('v187 强度旋钮只缩放数值，不改变天气本身', () => {
  saveBalance({ ...DEFAULT_BALANCE, weatherIntensity: 200 });
  assert.equal(weatherEffect('rain').targetPct, 8);
  saveBalance({ ...DEFAULT_BALANCE, weatherIntensity: 0 });
  assert.deepEqual(weatherEffect('rain'), {});
  saveBalance({ ...DEFAULT_BALANCE });
  clearBalanceCache();
  assert.equal(weatherEffect('rain').targetPct, 4);
});

test('v187 天气并进委托快照，和辖区、势力、污染各加一次', () => {
  const state = createInitialState();
  state.minutes = 22 * 60;
  const district = 'candy';
  const owner = state.territories[district];
  const level = pollutionForecast(state, district).level;
  const base = mergeDistrictEffects(districts[district].effect, factionEffect[owner], pollutionEffect(level));

  let checked = 0;
  for (let day = 1; day <= 40 && checked < 3; day += 1) {
    state.day = day;
    const weather = weatherAt(day, state.minutes);
    const effect = weatherEffect(weather);
    const snapshot = missionSnapshot(state, district, 100, 100);
    if (weather === 'clear') {
      assert.deepEqual(snapshot.environment, base, '晴天不该改动任何数值');
      continue;
    }
    for (const key of ['targetPct', 'rewardPct', 'fatigueFlat', 'damageDealtPct', 'damageTakenPct'] as const) {
      assert.equal(
        snapshot.environment[key] ?? 0,
        (base[key] ?? 0) + (effect[key] ?? 0),
        `${weather} 的 ${key} 应当只加一次`,
      );
    }
    checked += 1;
  }
  assert.ok(checked > 0, '40 天里应当至少遇到一次非晴天');
});

test('v187 委托按发布时刻还原天气，老委托回退第一段', () => {
  const spawnedAt = absoluteMinutes(12, 22 * 60 + 10);
  assert.equal(weatherForSpawn(spawnedAt, 12), weatherOf(12, 1));
  assert.equal(weatherForSpawn(undefined, 12), weatherOf(12, 0));
  assert.equal(weatherForSpawn(Number.NaN, 3), weatherOf(3, 0));
});

test('v187 顶栏预告取下一段，最后一段给自己', () => {
  assert.equal(nextWeather({ day: 5, minutes: 20 * 60 }), weatherOf(5, 1));
  assert.equal(nextWeather({ day: 5, minutes: 23 * 60 }), weatherOf(5, 2));
  assert.equal(nextWeather({ day: 5, minutes: 25 * 60 }), weatherOf(5, 2));
});

test('v187 提示词给的是事实与写法约束，不给数值', () => {
  const state = createInitialState();
  state.minutes = 23 * 60;
  const text = weatherPrompt(state);
  assert.ok(text.includes(WEATHERS[weatherAt(state.day, state.minutes)].name));
  assert.ok(text.includes('不要改写'));
  assert.ok(text.includes('不要写'), '应当交代清数值不外露');
  assert.ok(!text.includes('%'), '提示词里不能出现百分比数值');
  assert.ok(!text.includes('＋') && !text.includes('+'), '提示词里不能出现加成符号');
});
