import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { battleActors } from '../src/battleNote.ts';

/** 存过档之后，少女的立绘会搬进资产库：state 里只剩 portraitAsset，portrait 是空串。 */
function assetOnly(state: ReturnType<typeof createInitialState>) {
  return {
    ...state,
    girls: state.girls.map(girl => ({ ...girl, portrait: '', portraitAsset: `p-asset-${girl.id}` })),
  };
}

test('v137 立绘在资产库时，战斗单位也要带着资产 id', () => {
  const base = assetOnly(createInitialState());
  const girls = base.girls.filter(girl => !girl.retired);
  const dispatched = act(base, { type: 'dispatch', girlIds: [girls[0]!.id, girls[1]!.id], missionId: 'mirror' });
  assert.equal(dispatched.ok, true, dispatched.message);
  const battle = act(dispatched.state, { type: 'advance', minutes: 180 }).state.battles[0]!;
  const allies = battle.units.filter(unit => unit.side === 'ally');
  assert.ok(allies.length >= 1);
  for (const unit of allies) {
    assert.equal(unit.portrait, '', 'portrait 本来就是空的');
    assert.match(unit.portraitAsset ?? '', /^p-asset-/, '要带上资产 id，界面才画得出立绘');
  }
});

test('v137 只有资产 id 的角色仍然是「能说话的角色」', () => {
  const base = assetOnly(createInitialState());
  const girls = base.girls.filter(girl => !girl.retired);
  const dispatched = act(base, { type: 'dispatch', girlIds: [girls[0]!.id], missionId: 'mirror' });
  const battle = act(dispatched.state, { type: 'advance', minutes: 180 }).state.battles[0]!;
  const actors = battleActors(battle).filter(actor => actor.side === 'ally');
  assert.ok(actors.length >= 1);
  assert.ok(actors.every(actor => actor.speakable), '否则战报会把整队都判成不能说话');
});
