import { parseExpressionVariantKey, sanitizeExpressionVariants } from '../expressions.ts';
import { cardboxReport } from '../cardbox.ts';
import { customOutfitFor } from '../rules/outfits.ts';
import { CONTRACT_DAYS } from '../contracts.ts';
import { getSkill } from '../content/skills.ts';
import { sanitizeGirlFaction } from '../factions.ts';
import { traitById } from '../content/traits.ts';
import { girlCardHash } from '../cards.ts';
import { hydrate, makeCandidate } from '../rules/candidate.ts';
import { normalizeMarketWindow, unshiftMarketWindow } from '../rules/market.ts';
import { advancedCost, marketSize, marketUpgradeCost } from '../economy.ts';
import { factionInfo } from '../content/items.ts';
import { factionTask } from '../rules/missions.ts';
import { archive, book, clone, dateLabel, hashText } from '../rules/core.ts';
import type { ActionResult, GameAction, GameState, Girl, GirlCard, Trait } from '../types.ts';
// v35 从 src/game.ts 拆出：动作处理器。

/** acceptFactionTask 的动作处理器（v35 从 act 拆出）。 */
export function applyAcceptFactionTask(state: GameState, action: Extract<GameAction, { type: 'acceptFactionTask' }>): ActionResult {
      const next = clone(state); const faction = action.faction; const info = next.factions[faction];
      if (!info) return { state, ok: false, message: '未知势力。' };
      if (info.envoyTaskId) return { state, ok: false, message: '今天已经接下这位代表的委托了。' };
      const mission = factionTask(next, faction);
      next.missions.unshift(mission);
      info.envoyTaskId = mission.id;
      next.logs.unshift({ id: `log-envoy-${faction}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'council', text: `接下${factionInfo[faction].name}代表${factionInfo[faction].envoy}的委托「${mission.title}」。` });
      return { state: next, ok: true, message: `${factionInfo[faction].envoy}把任务书推了过来。` };
}

/** upgradeMarket 的动作处理器（v35 从 act 拆出）。 */
export function applyUpgradeMarket(state: GameState, _action: Extract<GameAction, { type: 'upgradeMarket' }>): ActionResult {
      const next = clone(state); const cost = marketUpgradeCost(next.marketLevel);
      if (!cost || next.marketLevel >= 4) return { state, ok: false, message: '市场已经达到最高等级。' };
      if (next.gold < cost) return { state, ok: false, message: `市场升级需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost); next.marketLevel += 1;
      // 扩建只多开窗口，不换今天已经挂牌的人，也不清掉售罄占位。
      normalizeMarketWindow(next, true);
      next.logs.unshift({ id: `log-market-${next.marketLevel}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `市场扩建至 ${next.marketLevel} 级，每日名册增加至 ${marketSize(next.marketLevel)} 位。`, delta: -cost });
      return { state: next, ok: true, message: `市场升至 ${next.marketLevel} 级。` };
}

/** advancedRecruit 的动作处理器（v35 从 act 拆出）。 */
export function applyAdvancedRecruit(state: GameState, action: Extract<GameAction, { type: 'advancedRecruit' }>): ActionResult {
      const next = clone(state); const level = action.level;
      if (!Number.isInteger(level) || level < 1 || level > 6) return { state, ok: false, message: '高级招聘只能指定 1–6 级。' };
      if (level > next.marketLevel + 2) return { state, ok: false, message: `当前市场等级最多指定 ${next.marketLevel + 2} 级。` };
      if (next.advancedDay === next.day) return { state, ok: false, message: '今天已经进行过一次高级招聘。' };
      const cost = advancedCost(level);
      if (next.gold < cost.gold) return { state, ok: false, message: `高级招聘需要 ${cost.gold} 星砂。` };
      if (next.reputation < cost.stability) return { state, ok: false, message: `城市安定度不足，需要 ${cost.stability}。` };
      if (next.candidates.length >= next.poolLimits.candidates) return { state, ok: false, message: `候选名册已满（${next.poolLimits.candidates} 位），请先签约或等待刷新。` };
      next.gold -= cost.gold; next.reputation -= cost.stability; book(next, next.day, -cost.gold);
      next.advancedDay = next.day;
      const girl = makeCandidate(next, level, next.day + level * 31);
      girl.candidateUntilDay = next.day + 3;
      next.candidates.unshift(girl);
      unshiftMarketWindow(next, girl.id);
      next.logs.unshift({ id: `log-advanced-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'dispatch', text: `通过协会渠道指定招募 ${level} 级候选者「${girl.name}」，城市安定度 -${cost.stability}。`, delta: -cost.gold });
      return { state: next, ok: true, message: `${girl.name}已加入候选名册，保留 3 天。` };
}

/**
 * 单张卡写进已克隆的 state；校验全部通过之前不改任何字段。
 *
 * v36 拆出来是为了让批量导入只克隆一次：以前 `applyImportCards` 逐张调用
 * `applyImportCard`，而后者每次进门都 `clone(state)`，N 张带立绘的卡就是 O(N²)
 * 次深拷贝（20 张 2.3MB ≈ 480MB 瞬时分配）。
 */
function importCardInto(next: GameState, card: GirlCard): { ok: true; name: string; message: string } | { ok: false; message: string } {
  const key = girlCardHash(card);
  const g = card.girl;
  const signature = (value: typeof g | Girl) => JSON.stringify([
    value.portrait ?? '', value.portraitSpec ?? null, value.wardrobe ?? null, value.outfitId ?? '',
    ('expression' in value ? value.expression : undefined) ?? 'calm', value.importedVariants ?? {},
    value.witchForm ?? null, value.witchPersonality ?? '', value.appearance ?? '', value.personality ?? '',
    value.outfitDescription ?? '', value.color ?? '',
  ]);
  const roster = [...next.girls, ...next.candidates];
  // 同一张卡在详情里换过立绘/表情后再导出：按卡号或（自定义卡）名字+代号认人，直接更新，而不是拒收或再养一个。
  const existing = roster.find(girl => girl.cardId === key)
    ?? roster.find(girl => girl.custom && girl.cardId && girl.name === g.name && girl.codename === g.codename);
  if (existing) {
    if (existing.cardRevision === signature(g)) return { ok: false, message: '这张契约卡已经导入过，不能重复登记。' };
    existing.cardId = key;
    existing.cardRevision = signature(g);
    existing.portrait = g.portrait ?? '';
    existing.portraitSpec = g.portraitSpec;
    if (g.wardrobe?.length) existing.wardrobe = g.wardrobe.map(outfit => ({ ...outfit }));
    existing.outfitId = g.outfitId ?? existing.outfitId;
    existing.expression = g.expression ?? existing.expression;
    existing.importedVariants = g.importedVariants ? { ...g.importedVariants } : undefined;
    existing.witchForm = g.witchForm ? { ...g.witchForm, id: 'witchform', form: 'witch' } : existing.witchForm;
    existing.witchPersonality = g.witchPersonality ?? existing.witchPersonality;
    existing.appearance = g.appearance ?? existing.appearance;
    existing.personality = g.personality ?? existing.personality;
    existing.outfitDescription = g.outfitDescription ?? existing.outfitDescription;
    existing.title = g.title ?? existing.title;
    existing.quote = g.quote ?? existing.quote;
    existing.goal = g.goal ?? existing.goal;
    existing.color = g.color || existing.color;
    next.logs.unshift({ id: `log-card-update-${existing.id}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `契约卡「${existing.name}」已用新版本覆盖：立绘、表情与衣柜跟着卡片一起更新。` });
    return { ok: true, name: existing.name, message: `契约卡已更新：${existing.name}的立绘与表情换成了卡里的版本。` };
  }
  if (next.candidates.length >= next.poolLimits.candidates) return { ok: false, message: `候选名册已满（${next.poolLimits.candidates} 位），请先移除一位候选或到设置中调高上限。` };
  if (!g.name || !Array.isArray(g.skillIds) || g.skillIds.length !== 3) return { ok: false, message: '契约卡资料不完整。' };
  const stats = { ...g.stats };
  const baseMaxHp = Math.round(96 + stats.empathy * 0.3);
  // 卡片自带定义的特性（自定义特性）优先；旧卡只写了 id，就只能靠全局目录。
  const cardTraits = (g.traits?.length
    ? g.traits.map(trait => ({ ...trait, tags: [...trait.tags] }))
    : g.traitIds.map(traitId => traitById.get(traitId)).filter((trait): trait is NonNullable<typeof trait> => Boolean(trait))
  ).slice(0, 6);
  const lostTraits = g.skippedTraits ?? 0;
  const id = `g_card_${key}`;
  // 出身按卡片来：导进来的少女保留她原来的立场，不再按 id 重新掷一次。
  // 旧卡片没有这个字段时，退回按名字确定性补齐，同一张卡导入结果始终一致。
  const cardOrigin = sanitizeGirlFaction(g.factionTag, g.name);
  const girl = hydrate({
    id, name: g.name, codename: g.codename, title: g.title, element: g.element, color: g.color,
    factionTag: cardOrigin,
    portrait: g.portrait ?? '', level: g.level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 0, maxSpirit: 0,
    fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
    skill: getSkill(g.skillIds[2]).name, skills: [...g.skillIds], description: g.appearance, cost: 1800 + g.level * 220,
    scars: [], relationships: {}, archetype: g.archetype, quote: g.quote,
    goal: g.goal, goalKind: '成长', traits: cardTraits, conditions: [],
    contractEndDay: next.day + 17, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
    appearance: g.appearance, personality: g.personality, witchPersonality: g.witchPersonality, outfitDescription: g.outfitDescription,
    wardrobe: g.wardrobe?.length
      ? g.wardrobe
      : [customOutfitFor({ color: g.color, outfitDescription: g.outfitDescription, portrait: g.portrait, portraitSpec: g.portraitSpec })],
    outfitId: g.wardrobe?.length ? (g.outfitId ?? g.wardrobe[0].id) : 'custom',
    expression: g.expression ?? 'calm',
    corruption: 0, equipment: {}, custom: true, candidateUntilDay: next.day + 7, cardId: key, cardRevision: signature(g),
    portraitSpec: g.portraitSpec, portraitHint: g.portraitHint ?? '', importedVariants: g.importedVariants,
    witchForm: g.witchForm ? { ...g.witchForm, id: 'witchform', form: 'witch' } : undefined,
  }, { clone: false });
  next.candidates.unshift(girl);
  unshiftMarketWindow(next, girl.id);
  archive(next, '登记', girl.name, `从契约卡导入。${girl.title}。${girl.appearance}`);
  const lostNote = lostTraits > 0 ? `（${lostTraits} 条特性没能随卡片带来，已跳过）` : '';
  next.logs.unshift({ id: `log-card-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `契约卡「${girl.name}」已导入候选名册，保留 7 天。${lostNote}` });
  return { ok: true, name: girl.name, message: `契约卡已导入：${girl.name}进入候选名册。${lostNote}` };
}

/** importCard 的动作处理器（v35 从 act 拆出）。 */
export function applyImportCard(state: GameState, action: Extract<GameAction, { type: 'importCard' }>): ActionResult {
  const next = clone(state);
  const result = importCardInto(next, action.card);
  return result.ok ? { state: next, ok: true, message: result.message } : { state, ok: false, message: result.message };
}

/** importCards 的动作处理器：整批只克隆一次 state。 */
export function applyImportCards(state: GameState, action: Extract<GameAction, { type: 'importCards' }>): ActionResult {
  const next = clone(state);
  const added: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  for (const card of action.cards) {
    const result = importCardInto(next, card);
    if (result.ok) { added.push(result.name); continue; }
    if (result.message.includes('已经导入过')) skipped.push(card.girl.name);
    else failed.push(card.girl.name);
  }
  if (!added.length) {
    return { state, ok: false, message: `没有新的契约卡进名册。${skipped.length ? `跳过重复 ${skipped.length} 张。` : ''}${failed.length ? `${failed.length} 张没能登记。` : ''}` };
  }
  next.logs.unshift({ id: `log-cardbox-${next.day}-${next.minutes}-${added.length}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `契约卡库导入 ${added.length} 张：${added.join('、')}。` });
  return { state: next, ok: true, message: cardboxReport(added.length, skipped.length, failed.length) };
}

/** refillMarket 的动作处理器（v35 从 act 拆出）。 */
export function applyRefillMarket(state: GameState, action: Extract<GameAction, { type: 'refillMarket' }>): ActionResult {
  // 市场补货：卡库里还没用过的卡 → 候选者。去重与上限由 importCardInto 兜住，整批只克隆一次。
  const next = clone(state);
  const added: string[] = [];
  let duplicate = 0;
  let failed = 0;
  for (const card of action.cards ?? []) {
    if (next.candidates.length >= next.poolLimits.candidates) break;
    const result = importCardInto(next, card);
    if (result.ok) { added.push(result.name); continue; }
    if (result.message.includes('已经导入过')) duplicate += 1;
    else failed += 1;
  }
  if (!added.length) {
    return { state, ok: false, message: duplicate ? '卡库里的卡都已经在市场里了。' : '卡库里的卡没能补进市场。' };
  }
  next.logs.unshift({ id: `log-market-cards-${next.day}-${added.length}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `市场补进了 ${added.length} 位新面孔：${added.join('、')}。` });
  return { state: next, ok: true, message: `市场补进了 ${added.length} 位新面孔。${failed ? `另有 ${failed} 张没能登记。` : ''}` };
}

/** createGirl 的动作处理器（v35 从 act 拆出）。 */
export function applyCreateGirl(state: GameState, action: Extract<GameAction, { type: 'createGirl' }>): ActionResult {
      const next = clone(state); const draft = action.draft;
      if (next.gold < 300) return { state, ok: false, message: '发布自定义契约需要 300 星砂登记费。' };
      if (next.candidates.length >= next.poolLimits.candidates) return { state, ok: false, message: '候选名册已满。' };
      if (!next.blank && next.reputation < 40) return { state, ok: false, message: '城市安定度需要达到 40 才能撰写新契约。' };
      const stats = draft.stats;
      const sum = stats.magic + stats.insight + stats.agility + stats.empathy;
      if (Object.values(stats).some(v => !Number.isFinite(v) || v < 40 || v > 90) || sum !== 260) return { state, ok: false, message: '四维每项需在 40–90，且总和必须为 260。' };
      if (draft.skillIds.length !== 3 || new Set(draft.skillIds).size !== 3) return { state, ok: false, message: '请选择三个不同的技能。' };
      if (draft.traits.length > 3) return { state, ok: false, message: '最多填写三个特性。' };
      const traits: Trait[] = draft.traits.filter(trait => trait.name.trim()).slice(0, 3).map(trait => ({
        id: `custom-trait-${hashText(`${trait.name}:${draft.name}`).toString(16)}`,
        name: trait.name.trim().slice(0, 16),
        polarity: trait.polarity,
        tags: ['自定义'],
        description: trait.description.trim().slice(0, 120) || '写在契约背面的那句话。',
      }));
      const baseMaxHp = Math.round(96 + stats.empathy * 0.3);
      const extra = draft.skillIds.reduce((acc, id) => acc + (getSkill(id).tier === 'ultimate' ? 700 : getSkill(id).tier === 'signature' ? 300 : 0), 0);
      const id = `g_${hashText(`${draft.name}:${next.day}:${next.minutes}:${next.candidates.length}`).toString(16).padStart(8, '0')}`;
      const customOutfit = customOutfitFor({ color: draft.color, outfitDescription: draft.outfitDescription, portrait: draft.portrait, portraitSpec: draft.appearanceSpec });
      const wardrobe = draft.wardrobe?.length ? draft.wardrobe.slice(0, 4) : [customOutfit];
      const witchForm = draft.witchForm ? { ...draft.witchForm, id: 'witchform' as const, form: 'witch' as const } : undefined;
      const outfitId = draft.outfitId && wardrobe.some(outfit => outfit.id === draft.outfitId) ? draft.outfitId : wardrobe[0].id;
      const validOutfitIds = new Set(wardrobe.map(outfit => outfit.id));
      if (witchForm) validOutfitIds.add('witchform');
      const importedVariants = sanitizeExpressionVariants(draft.importedVariants);
      for (const key of Object.keys(importedVariants)) {
        const parsed = parseExpressionVariantKey(key);
        if (!parsed || !validOutfitIds.has(parsed.outfitId)) delete importedVariants[key];
      }
      const girl = hydrate({
        id, name: draft.name, codename: draft.codename, title: draft.title, element: draft.element, color: draft.color,
        portrait: draft.portrait ?? wardrobe.find(outfit => outfit.portrait)?.portrait ?? '', portraitCrop: draft.portraitCrop, level: 1, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 0, maxSpirit: 0,
        fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
        skill: getSkill(draft.skillIds[2]).name, skills: draft.skillIds, description: draft.appearance, cost: 1800 + Math.max(0, sum - 260) * 40 + extra,
        scars: [], relationships: {}, archetype: draft.archetype, quote: draft.quote,
        goal: draft.goal, goalKind: '成长', traits, conditions: [],
        contractEndDay: next.day + 17, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: draft.appearance, personality: draft.personality, outfitDescription: draft.outfitDescription,
        portraitHint: draft.portraitHint?.trim().slice(0, 80) ?? '',
        wardrobe, outfitId, importedVariants, witchForm, expression: 'calm', corruption: 0, equipment: {}, custom: true, candidateUntilDay: next.day + 7,
        factionTag: draft.factionTag,
      });
      next.gold -= 300; book(next, next.day, -300);
      next.candidates.unshift(girl);
      unshiftMarketWindow(next, girl.id);
      archive(next, '登记', girl.name, `${girl.title}。${girl.appearance}`);
      next.logs.unshift({ id: `log-custom-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `新契约「${girl.name}」已发布到候选名册，保留 7 天。登记费 300 星砂。`, delta: -300 });
      return { state: next, ok: true, message: `${girl.name}已进入候选名册。` };
}
