import { sanitizePortraitSrc } from '../image.ts';
import { defaultWitchPersonality } from '../personality.ts';
import { loadBalance } from '../balance.ts';
import { WITCH_STAGE_AT } from '../economy.ts';
import { EXPRESSION_VARIANT_LIMIT, currentExpressionOutfitId, expressionLabel, isExpressionVariantData, parseExpressionVariantKey } from '../expressions.ts';
import { WARDROBE_LIMIT } from '../rules/labels.ts';
import { sanitizeVoice } from '../voice.ts';
import { pruneOrphanVariants, sanitizeOutfit } from '../rules/outfits.ts';
import { allocatePoint, statLabel } from '../progression.ts';
import { buildCost } from '../rules/roster.ts';
import { book, clone, dateLabel, findRosterGirl, pushNotice } from '../rules/core.ts';
import type { ActionResult, GameAction, GameState, Outfit } from '../types.ts';
// v35 从 src/game.ts 拆出：动作处理器。

/** build 的动作处理器（v35 从 act 拆出）。 */
export function applyBuild(state: GameState, action: Extract<GameAction, { type: 'build' }>): ActionResult {
      const next = clone(state); const room = next.rooms.find(r => r.id === (action.roomId ?? 'dorm')) ?? next.rooms.find(r => r.type === 'dorm')!;
      if (room.level >= 4) return { state, ok: false, message: '这个房间已经达到最高等级。' };
      const cost = buildCost(room);
      if (next.gold < cost) return { state, ok: false, message: `星砂不足，扩建需要 ${cost}。` };
      next.gold -= cost; room.level += 1;
      book(next, next.day, -cost);
      if (room.type === 'dorm') room.capacity += 2;
      next.logs.unshift({ id: `log-build-${room.id}-${room.level}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `${room.name}升至 ${room.level} 级${room.type === 'dorm' ? '，新增 2 个契约席位' : ''}。`, delta: -cost });
      return { state: next, ok: true, message: `${room.name}已升级${room.type === 'dorm' ? '，新增 2 个席位' : ''}。` };
}

/** changeOutfit 的动作处理器（v35 从 act 拆出）。 */
export function applyChangeOutfit(state: GameState, action: Extract<GameAction, { type: 'changeOutfit' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.witch) return { state, ok: false, message: '魔女化期间已锁定在魔女化立绘；先点击衣柜第五格恢复普通形态。' };
      if (!girl.wardrobe.some(o => o.id === action.outfitId)) return { state, ok: false, message: '衣柜里没有这套服装。' };
      girl.outfitId = action.outfitId;
      return { state: next, ok: true, message: `${girl.name}换上了「${girl.wardrobe.find(o => o.id === action.outfitId)?.name}」。` };
}

/** setExpression 的动作处理器（v35 从 act 拆出）。 */
export function applySetExpression(state: GameState, action: Extract<GameAction, { type: 'setExpression' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      girl.expression = action.expression;
      return { state: next, ok: true, message: `${girl.name}的表情已切换。` };
}

/** setPersonality 的动作处理器（v35 从 act 拆出）。 */
export function applySetPersonality(state: GameState, action: Extract<GameAction, { type: 'setPersonality' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const text = action.text.trim().slice(0, 600);
      if (!text) return { state, ok: false, message: '性格描述不能为空。' };
      if (girl.witch) girl.witchPersonality = text;
      else girl.personality = text;
      return { state: next, ok: true, message: girl.witch ? `${girl.name}的魔女化性格记录已更新。` : `${girl.name}的性格记录已更新。` };
}

/** allocateStat 的动作处理器（v35 从 act 拆出）。 */
export function applyAllocateStat(state: GameState, action: Extract<GameAction, { type: 'allocateStat' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const result = allocatePoint(girl, action.stat, action.amount ?? 1);
      if (!result.ok) return { state, ok: false, message: result.message };
      const stat = statLabel[action.stat];
      return { state: next, ok: true, message: `${girl.name}的${stat}提升到 ${girl.stats[action.stat]}，还剩 ${girl.unspentPoints ?? 0} 点。` };
}

/** allocateStats 的动作处理器：属性点滑条一次提交四项，只克隆一次 state。 */
export function applyAllocateStats(state: GameState, action: Extract<GameAction, { type: 'allocateStats' }>): ActionResult {
  const next = clone(state);
  const girl = findRosterGirl(next, action.girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  const spent: string[] = [];
  for (const key of ['magic', 'insight', 'agility', 'empathy'] as const) {
    const want = Math.max(0, Math.round(Number(action.plan[key] ?? 0)));
    if (!want) continue;
    const result = allocatePoint(girl, key, want);
    // 点数不够就整批作废：返回原状态，绝不半截生效。
    if (!result.ok) return { state, ok: false, message: result.message };
    spent.push(`${statLabel[key]} +${want}`);
  }
  if (!spent.length) return { state, ok: false, message: '还没有要加的点。' };
  return { state: next, ok: true, message: `${girl.name}：${spent.join('、')}，还剩 ${girl.unspentPoints ?? 0} 点。` };
}

/** 两段可以手改的档案文本：清掉换行、限长 240、允许清空。 */
function applyProfileText(
  state: GameState,
  action: { girlId: string; text: string },
  field: 'appearance' | 'outfitDescription' | 'voiceTone' | 'voiceHabits' | 'voiceSamples',
): ActionResult {
  const next = clone(state);
  const girl = findRosterGirl(next, action.girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  const raw = String(action.text ?? '');
  const isVoice = field === 'voiceTone' || field === 'voiceHabits' || field === 'voiceSamples';
  if (isVoice) {
    const patch: Record<string, unknown> = { ...(girl.voice ?? {}) };
    if (field === 'voiceTone') patch.tone = raw;
    else patch[field === 'voiceHabits' ? 'habits' : 'samples'] = raw.split(/\r?\n/);
    girl.voice = sanitizeVoice(patch);
    const label = field === 'voiceTone' ? '说话方式' : field === 'voiceHabits' ? '口头习惯' : '例话';
    next.logs.unshift({
      id: `log-profile-${field}-${girl.id}-${Date.now()}`,
      time: dateLabel(next.day, next.minutes), kind: 'base',
      text: `${girl.name}的${label}被改写了：${raw.replace(/\s+/g, ' ').trim().slice(0, 80) || '（清空）'}`,
    });
    return { state: next, ok: true, message: `${label}已更新。` };
  }
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 240);
  girl[field] = text;
  const label = field === 'appearance' ? '外貌' : '服装描述';
  next.logs.unshift({
    id: `log-profile-${field}-${girl.id}-${Date.now()}`,
    time: dateLabel(next.day, next.minutes), kind: 'base',
    text: `${girl.name}的${label}被改写了：${text || '（清空）'}`,
  });
  return { state: next, ok: true, message: `${girl.name}的${label}已更新。` };
}

/** setProfileText 的动作处理器：外貌 / 服装描述。 */
export function applySetProfileText(state: GameState, action: Extract<GameAction, { type: 'setProfileText' }>): ActionResult {
  return applyProfileText(state, action, action.field);
}

/** setLevelUpMode 的动作处理器（v35 从 act 拆出）。 */
export function applySetLevelUpMode(state: GameState, action: Extract<GameAction, { type: 'setLevelUpMode' }>): ActionResult {
      if (state.levelUpMode === action.mode) return { state, ok: false, message: '已经是这个模式了。' };
      const next = clone(state);
      next.levelUpMode = action.mode;
      next.logs.unshift({ id: `log-level-mode-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `升级成长方式改为${action.mode === 'manual' ? '手动加点：升级只发 10 点，由你分配' : '自动加点：按职阶直接成长'}。` });
      return { state: next, ok: true, message: action.mode === 'manual' ? '以后升级会发可分配点数。' : '以后升级按职阶自动加属性。' };
}

/** importWardrobe 的动作处理器（v35 从 act 拆出）。 */
export function applyImportWardrobe(state: GameState, action: Extract<GameAction, { type: 'importWardrobe' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const base = action.mode === 'replace' ? [] : girl.wardrobe;
      const incoming = action.outfits
        .map(outfit => sanitizeOutfit(outfit, girl.color))
        .filter((outfit): outfit is Outfit => Boolean(outfit))
        .filter(outfit => !base.some(existing => existing.id === outfit.id || existing.name === outfit.name));
      if (!incoming.length) return { state, ok: false, message: '没有可以导入的新服装（名称为空或与现有衣柜重名）。' };
      const merged: Outfit[] = [];
      for (const outfit of [...base, ...incoming]) {
        if (merged.some(existing => existing.id === outfit.id || existing.name === outfit.name)) continue;
        merged.push(outfit);
      }
      const kept = merged.slice(0, WARDROBE_LIMIT);
      const added = incoming.filter(outfit => kept.some(item => item.id === outfit.id)).length;
      const dropped = incoming.length - added;
      girl.wardrobe = kept;
      if (action.outfitId && kept.some(outfit => outfit.id === action.outfitId)) girl.outfitId = action.outfitId;
      else if (!kept.some(outfit => outfit.id === girl.outfitId)) girl.outfitId = kept[0].id;
      pruneOrphanVariants(girl);
      next.logs.unshift({ id: `log-wardrobe-import-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}的衣柜${action.mode === 'replace' ? '被替换并' : ''}新增 ${added} 套服装${dropped ? `（${dropped} 套因衣柜已满未导入）` : ''}。` });
      return { state: next, ok: true, message: `已导入 ${added} 套服装${dropped ? `，${dropped} 套因衣柜已满未导入` : ''}。` };
}

/** removeOutfit 的动作处理器（v35 从 act 拆出）。 */
export function applyRemoveOutfit(state: GameState, action: Extract<GameAction, { type: 'removeOutfit' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.wardrobe.length <= 1) return { state, ok: false, message: '至少要为契约者保留一套服装。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      girl.wardrobe = girl.wardrobe.filter(item => item.id !== action.outfitId);
      if (girl.outfitId === action.outfitId) girl.outfitId = girl.wardrobe[0].id;
      pruneOrphanVariants(girl);
      return { state: next, ok: true, message: `「${outfit.name}」已从衣柜移除。` };
}

/** renameOutfit 的动作处理器（v35 从 act 拆出）。 */
export function applyRenameOutfit(state: GameState, action: Extract<GameAction, { type: 'renameOutfit' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      const name = action.name.trim().slice(0, 16);
      if (!name) return { state, ok: false, message: '服装名称不能为空。' };
      if (girl.wardrobe.some(item => item.id !== outfit.id && item.name === name)) return { state, ok: false, message: '衣柜里已经有同名服装。' };
      outfit.name = name;
      if (action.description !== undefined) outfit.description = action.description.trim().slice(0, 120);
      return { state: next, ok: true, message: `服装已改名为「${name}」。` };
}

/** setVariant 的动作处理器（v35 从 act 拆出）。 */
export function applySetVariant(state: GameState, action: Extract<GameAction, { type: 'setVariant' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const parsed = parseExpressionVariantKey(action.key);
      if (!parsed) return { state, ok: false, message: '表情差分的服装或表情无法识别。' };
      if (!isExpressionVariantData(action.dataUrl)) return { state, ok: false, message: '差分需要是 8MB 以内的图片。' };
      if (!girl.importedVariants) girl.importedVariants = {};
      const usedForOutfit = Object.keys(girl.importedVariants).filter(key => parseExpressionVariantKey(key)?.outfitId === parsed.outfitId).length;
      if (!girl.importedVariants[action.key] && usedForOutfit >= EXPRESSION_VARIANT_LIMIT) return { state, ok: false, message: `这套服装最多保存 ${EXPRESSION_VARIANT_LIMIT} 张表情差分，请先删除旧图。` };
      girl.importedVariants[action.key] = action.dataUrl;
      return { state: next, ok: true, message: `「${expressionLabel(parsed.expression)}」表情差分已保存。` };
}

/** setVariants 的动作处理器（v35 从 act 拆出）。 */
export function applySetVariants(state: GameState, action: Extract<GameAction, { type: 'setVariants' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const entries = Object.entries(action.variants);
      if (!entries.length) return { state, ok: false, message: '没有可保存的表情差分。' };
      const staged = { ...(girl.importedVariants ?? {}) };
      for (const [key, dataUrl] of entries) {
        if (!parseExpressionVariantKey(key)) return { state, ok: false, message: `无法识别差分键「${key}」。` };
        if (!isExpressionVariantData(dataUrl)) return { state, ok: false, message: '差分需要是 8MB 以内的图片。' };
        staged[key] = dataUrl;
      }
      const perOutfit = new Map<string, number>();
      for (const key of Object.keys(staged)) {
        const parsed = parseExpressionVariantKey(key);
        if (!parsed) return { state, ok: false, message: `无法识别差分键「${key}」。` };
        perOutfit.set(parsed.outfitId, (perOutfit.get(parsed.outfitId) ?? 0) + 1);
      }
      if ([...perOutfit.values()].some(count => count > EXPRESSION_VARIANT_LIMIT)) return { state, ok: false, message: `每套服装最多保存 ${EXPRESSION_VARIANT_LIMIT} 张表情差分。` };
      girl.importedVariants = staged;
      return { state: next, ok: true, message: `已保存 ${entries.length} 张表情差分。` };
}

/** deleteVariant 的动作处理器（v35 从 act 拆出）。 */
export function applyDeleteVariant(state: GameState, action: Extract<GameAction, { type: 'deleteVariant' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.importedVariants?.[action.key]) return { state, ok: false, message: '这张表情差分已经不存在。' };
      delete girl.importedVariants[action.key];
      return { state: next, ok: true, message: '表情差分已移除。' };
}

/** setOutfitDescription 的动作处理器（v35 从 act 拆出）。 */
export function applySetOutfitDescription(state: GameState, action: Extract<GameAction, { type: 'setOutfitDescription' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      const description = action.description.trim().slice(0, 200);
      if (!description) return { state, ok: false, message: '描述不能为空。' };
      outfit.description = description;
      // 正在穿的这套改了描述，就把「她此刻的装扮」同步过去：提示词与导出卡片读的是这个字段。
      if (currentExpressionOutfitId(girl) === outfit.id) girl.outfitDescription = description;
      return { state: next, ok: true, message: `「${outfit.name}」的描述已更新。` };
}

/** setWitchForm 的动作处理器（v35 从 act 拆出）。 */
export function applySetWitchForm(state: GameState, action: Extract<GameAction, { type: 'setWitchForm' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!action.outfit) {
        // v85：魔女化不再能靠取消礼装自己退。要压回去只能用一支月光抑制剂。
        if (!girl.witch) return { state, ok: false, message: `${girl.name}现在没有处于魔女化状态。` };
        return { state, ok: false, message: `魔女化不会自己退。要在诊所给${girl.name}用一支月光抑制剂（clearWitchForm）才能压回去。` };
      }
      const activate = action.activate !== false;
      const witchAt = loadBalance().corruptionThreshold;
      if (activate && girl.corruption < witchAt && !girl.witch) return { state, ok: false, message: `${girl.name}的侵蚀还没有到能切换到魔女姿态的程度（${witchAt}）。立绘仍可以先导入。` };
      const outfit = sanitizeOutfit({ ...action.outfit, id: 'witchform', form: 'witch' }, girl.color);
      if (!outfit) return { state, ok: false, message: '这份魔女化立绘无法识别。' };
      girl.witchForm = { ...outfit, form: 'witch' };
      const witchPersonality = action.personality?.trim().slice(0, 600);
      if (witchPersonality) girl.witchPersonality = witchPersonality;
      if (!activate) return { state: next, ok: true, message: `${girl.name}的魔女化立绘已保存到衣柜第五格。` };
      const firstTime = !girl.witch;
      girl.witch = true;
      if (!girl.witchPersonality?.trim()) girl.witchPersonality = defaultWitchPersonality(girl);
      if (firstTime) {
        // 第一次踏进魔女形态：给她一条单独的通知，别只混在日志里。
        const seen = (next.notices ?? []).some(notice => notice.kind === 'witch' && notice.girlId === girl.id);
        if (!seen) {
          pushNotice(next, {
            kind: 'witch', day: next.day, minutes: next.minutes, title: `${girl.name}魔女化了`,
            text: '侵蚀漫过阈值之后她就回不去了：形态锁定，只能用月光抑制剂压回来。',
            girlId: girl.id,
          });
        }
      }
      next.logs.unshift({ id: `log-witchform-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}允许你保存了她的魔女化立绘。` });
      return { state: next, ok: true, message: `${girl.name}已切换到魔女化立绘，普通服装暂时锁定。` };
}

/** clearWitchForm 的动作处理器（v35 从 act 拆出）。 */
export function applyClearWitchForm(state: GameState, action: Extract<GameAction, { type: 'clearWitchForm' }>): ActionResult {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.witchForm) return { state, ok: false, message: '还没有保存过魔女化立绘。' };
      // v85：形态锁定之后立绘不能摘——先用抑制剂压回普通形态。
      if (girl.witch) return { state, ok: false, message: `${girl.name}还在魔女形态里，先用抑制剂压回去再撤立绘。` };
      girl.witchForm = undefined;
      return { state: next, ok: true, message: `${girl.name}的魔女化立绘已撤下，第五格重新空出。` };
}

/** setPortrait 的动作处理器：立绘坏了就换一张能用的。 */
export function applySetPortrait(state: GameState, action: Extract<GameAction, { type: 'setPortrait' }>): ActionResult {
  const next = clone(state);
  const girl = findRosterGirl(next, action.girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  const portrait = action.portrait === '' ? '' : sanitizePortraitSrc(action.portrait);
  if (portrait === undefined) return { state, ok: false, message: '这张图存不进存档：换一张 JPG / PNG。' };
  girl.portrait = portrait;
  next.logs.unshift({
    id: `log-portrait-${girl.id}-${Date.now()}`,
    time: dateLabel(next.day, next.minutes), kind: 'base',
    text: portrait ? `${girl.name}的立绘重新载入。` : `${girl.name}的立绘被清空。`,
  });
  return { state: next, ok: true, message: portrait ? '立绘已重新载入。' : '立绘已清空。' };
}

/** suppressWitch 的动作处理器（v85）：用月光抑制剂把魔女形态压回去，立绘留在第五格。 */
export function applySuppressWitch(state: GameState, action: Extract<GameAction, { type: 'suppressWitch' }>): ActionResult {
  const next = clone(state);
  const girl = findRosterGirl(next, action.girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (!girl.witch) return { state, ok: false, message: `${girl.name}现在不是魔女形态。` };
  // v200：越过 70 之后回不去——抑制剂只负责续命。
  if ((girl.corruption ?? 0) >= WITCH_STAGE_AT) return { state, ok: false, message: `${girl.name}已经越过那条线：月光抑制剂只能续命，压不回普通形态。唯一解除方式是记忆重塑。` };
  if ((next.inventory['moon-drug'] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有月光抑制剂，压不回去。' };
  next.inventory['moon-drug'] -= 1;
  girl.witch = false;
  girl.drugUntilDay = Math.max(girl.drugUntilDay ?? 0, next.day + 10);
  next.logs.unshift({ id: `log-witch-suppress-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `给${girl.name}用了一支月光抑制剂，魔女形态压了回去（剩下 ${next.inventory['moon-drug']} 支）。` });
  return { state: next, ok: true, message: `${girl.name}恢复了普通形态，抑制剂剩 ${next.inventory['moon-drug']} 支。` };
}
