import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICT_BACKDROP_IDS, resolveBackdrop, storyBackdropOf } from '../src/vn/backdrops.ts';
import { beatsFromTurns } from '../src/vn/beats.ts';

test('v178 九块辖区都有夜景图，缺图才退回渐变', () => {
  assert.equal(DISTRICT_BACKDROP_IDS.length, 9);
  for (const id of DISTRICT_BACKDROP_IDS) {
    assert.equal(resolveBackdrop(id).image, `/art/districts/${id}.jpg`);
  }
  assert.equal(resolveBackdrop('night').image, '');
  assert.ok(resolveBackdrop('night').gradient.includes('radial-gradient'));
});

test('v178 剧情背景：会议地点是辖区就用那一块', () => {
  assert.equal(storyBackdropOf({ id: 'e1', meeting: { placeId: 'district:docks' } }).id, 'docks');
  assert.equal(storyBackdropOf({ id: 'e1', meeting: { placeId: 'district:clocktower' } }).id, 'clocktower');
});

test('v178 剧情背景：屋里的会还是屋里，不会莫名其妙挪到码头', () => {
  const backdrop = storyBackdropOf({ id: 'e2', meeting: { placeId: 'room:lounge' } });
  assert.equal(backdrop.id, 'room:lounge');
  assert.equal(resolveBackdrop(backdrop.id).image, '/art/council-lounge.jpg');
});

test('v178 剧情背景：没有地点线索时按事件 id 稳定分一块辖区', () => {
  const first = storyBackdropOf({ id: 'event-abc' });
  const again = storyBackdropOf({ id: 'event-abc' });
  assert.equal(first.id, again.id);
  assert.ok((DISTRICT_BACKDROP_IDS as readonly string[]).includes(first.id));
  // 不同的事件不会全挤在同一块辖区。
  const spread = new Set(['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].map(id => storyBackdropOf({ id }).id));
  assert.ok(spread.size > 1);
});

test('v178 剧情背景：场景里点名了辖区就用它', () => {
  assert.equal(storyBackdropOf({ id: 'e3', scenes: [{ scene: 'cathedral' }], stage: 0 }).id, 'cathedral');
  assert.equal(storyBackdropOf({ id: 'e4', scenes: [{ scene: 'unknown-place' }] }).id, storyBackdropOf({ id: 'e4' }).id);
});

test('v178 剧情背景：舞台第一拍就是这块背景', () => {
  const beats = beatsFromTurns(
    [{ id: 't1', role: 'narrator', text: '雨落在铁皮上。', lines: [] }],
    { playerName: '所长', scene: { id: 'docks' } },
  );
  assert.equal(beats[0]?.kind, 'bg');
  assert.equal(beats[0]?.kind === 'bg' ? beats[0].backdrop.id : '', 'docks');
});
