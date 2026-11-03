import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { openIncidentFor } from '../src/incidents.ts';
import type { Incident } from '../src/types.ts';

function incident(id: string, blocking: boolean): Incident {
  return {
    id, kind: 'girl', title: id, body: `${id} 的正文`, day: 14, minutes: 1260,
    status: 'pending', blocking, source: 'llm',
    // 有选项才算「要拿主意」；纯通报（report）本来就不该拦住时间。
    options: [{ id: 'o1', label: '处理', hint: '' }],
  } as unknown as Incident;
}

const base = createInitialState();

test('v81 事件自己找上门：没有阻塞事件时把最新一条未推迟的摆出来', () => {
  const state = { ...base, incidents: [incident('a', false), incident('b', false)] };
  assert.equal(openIncidentFor(state)?.id, 'b', '最新的先弹');
  assert.equal(openIncidentFor(state, ['b'])?.id, 'a', '推迟过的跳过，换下一条');
  assert.equal(openIncidentFor(state, ['a', 'b']), undefined, '都推迟了就不弹');
});

test('v81 必须立刻决定的事件永远优先', () => {
  const state = { ...base, incidents: [incident('old', true), incident('new', false)] };
  assert.equal(openIncidentFor(state, ['old'])?.id, 'old', '阻塞事件不受「稍后再说」影响');
  const resolved = { ...base, incidents: [{ ...incident('done', false), status: 'resolved' } as Incident] };
  assert.equal(openIncidentFor(resolved), undefined, '处理完的不再弹');
});
