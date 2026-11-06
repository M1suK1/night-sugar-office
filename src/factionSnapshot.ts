/**
 * 「今夜的三方局面」：三方之间的火气值 + 她那一方对事务所的态度。
 *
 * 剧情提示词里以前只有她本人、在场的人与这一段的前情，三方关系要玩家自己从大地图上记。
 * 首领约谈尤其吃亏：她开口的分寸取决于她那一方跟另外两方有多紧张、跟事务所处得怎么样，
 * 这些都在 state 里，只是没人给模型。
 */
import type { FactionId, GameState } from './types.ts';
import { factionInfo } from './content/items.ts';
import { FACTION_ORDER } from './territories.ts';
import { factionAttitude } from './economy.ts';
import { HOSTILITY_PAIRS, hostilityTierLabel, hostilityValue, pairMembers } from './hostility.ts';

/** 三方火气：三条线一起给，模型才写得出「谁在压谁」。用全名，别让提示词里出现「星灯」这种缩写。 */
export function hostilityBrief(state: GameState): string {
  return HOSTILITY_PAIRS
    .map(pair => {
      const label = pairMembers(pair).map(id => factionInfo[id].name).join(' ↔ ');
      const value = hostilityValue(state, pair);
      return `${label} ${value}（${hostilityTierLabel(value)}）`;
    })
    .join(' · ');
}

/** 某一方对事务所的态度：声望档位 + 具体数字 + 她现在能不能买到东西。 */
export function attitudeBrief(state: GameState, faction: FactionId): string {
  const standing = state.factions?.[faction]?.standing ?? 0;
  const attitude = factionAttitude(standing);
  return `对你的态度 ${attitude.label}（声望 ${standing}/100，${attitude.discount}）`;
}

/**
 * 一段剧情用的局面说明。
 *
 * `faction` 是她所属的那一方（名册里的首领/随从），给了就多说一句她那一方的处境；
 * 没有（契约者）就只报三方火气与三方态度。
 */
export function factionSnapshotText(state: GameState | undefined, faction?: FactionId): string {
  if (!state) return '';
  const lines = [`【今夜的三方局面】火气：${hostilityBrief(state)}`];
  if (faction) {
    lines.push(`【她那一方】${factionInfo[faction].name} · ${attitudeBrief(state, faction)}`);
  } else {
    lines.push(`【三方对你的态度】${FACTION_ORDER.map(id => `${factionInfo[id].name} ${attitudeBrief(state, id)}`).join('；')}`);
  }
  return lines.join('\n');
}
