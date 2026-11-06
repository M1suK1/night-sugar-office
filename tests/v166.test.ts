import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankState, createInitialState } from '../src/game.ts';
import { DEFAULT_OFFICE_PROFILE } from '../src/office.ts';
import { loadOfficeProfile, saveOfficeProfile, OFFICE_PROFILE_KEY } from '../src/officeProfile.ts';

function fakeStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => { data.clear(); },
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
  return { storage, data };
}

test('v166 事务所档案默认值可保存并被新开局读取', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const { storage, data } = fakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const profile = {
      background: '旧城河边的三层小楼，门口总有一盏不灭的灯。',
      philosophy: '不替任何一方站队，但也不会把来求助的人推回雨里。',
      goal: '把事务所做成三方都愿意落座的夜间中立站。',
    };
    assert.equal(saveOfficeProfile(profile), true);
    assert.equal(data.has(OFFICE_PROFILE_KEY), true);
    assert.deepEqual(loadOfficeProfile(), profile);

    const state = createInitialState();
    assert.equal(state.office.background, profile.background);
    assert.equal(state.office.philosophy, profile.philosophy);
    assert.equal(state.office.goal, profile.goal);

    const blank = createBlankState();
    assert.equal(blank.office.background, profile.background);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('v166 本地默认值缺失时回落到内置事务所档案', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const { storage } = fakeStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    assert.deepEqual(loadOfficeProfile(), DEFAULT_OFFICE_PROFILE);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
