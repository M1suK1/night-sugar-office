import type {
  FactionId, GameState, Incident, IncidentCondition, IncidentOption,
  IncidentTemplate, IncidentTrigger, WorkKind,
} from './types.ts';
import type { DistrictId } from './districts.ts';
import { factionInfo } from './content/items.ts';
import { representativeNameOf } from './factions.ts';
import { districts } from './districts.ts';
import { builtinIncidents, warSignalTemplates } from './content/incidents.ts';
import { dirtiestDistrict } from './pollution.ts';

/** 同时待处理的弹窗上限。超出的留在池子里，处理掉一个才顶上来。 */
export const INCIDENT_PENDING_LIMIT = 5;
export const INCIDENT_DEFAULT_TTL = 240;
export const INCIDENT_DEFAULT_COOLDOWN = 7;
/** 每晚最多补进池子的条数。 */
export const INCIDENT_POOL_CAP = 10;

export function incidentMinute(day: number, minutes: number) { return day * 1440 + minutes; }

function hashText(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
}

function pickByHash<T>(list: T[], seed: string): T | undefined {
  if (!list.length) return undefined;
  return list[hashText(seed) % list.length];
}

export function incidentPending(state: GameState) {
  return state.incidents.filter(item => item.status === 'pending');
}

/** 只有「要拿主意」和「一段剧情」会拦住时间推进；纯通报可以放着。 */
export function blockingIncidents(state: GameState) {
  return incidentPending(state).filter(item => {
    if (incidentCategoryOf(item) === 'report') return false;
    if (item.blocking === false) return false;   // 蓝图里显式标成「可延后」的弹窗
    if (!item.trigger) return true;              // 工坊投放与模型拟稿：一直拦住
    return item.trigger.kind === 'dayStart';     // 只有开门前摆上桌的那种必须当场决定
  });
}

export function incidentCategoryOf(incident: Incident) {
  if (incident.category) return incident.category;
  if (incident.scene) return 'scene' as const;
  return incident.options.length === 0 ? ('report' as const) : ('decision' as const);
}

/** 这条事件还剩多少分钟过期；没有 expiresAt 就按 ttl 算。 */
export function incidentRemaining(incident: Incident, at: { day: number; minutes: number }) {
  if (typeof incident.expiresAt !== 'number') return INCIDENT_DEFAULT_TTL;
  return incident.expiresAt - incidentMinute(at.day, at.minutes);
}

export function conditionMet(state: GameState, condition: IncidentCondition): boolean {
  const value = (() => {
    switch (condition.field) {
      case 'reputation': return state.reputation;
      case 'gold': return state.gold;
      case 'day': return state.day;
      case 'pollution': {
        const id = condition.district ?? dirtyDistrictId(state);
        return state.pollution[id] ?? 0;
      }
      case 'faction': {
        const id = condition.faction ?? 'association';
        return state.factions[id]?.standing ?? 0;
      }
      case 'bond': {
        const girl = condition.girlId ? state.girls.find(item => item.id === condition.girlId) : maxGirl(state, 'bond');
        return girl?.bond ?? 0;
      }
      case 'fatigue': {
        if (condition.girlId) return state.girls.find(item => item.id === condition.girlId)?.fatigue ?? 0;
        return state.girls.filter(item => !item.dead && !item.retired).filter(item => item.fatigue >= condition.value).length;
      }
      case 'girlCount':
        return state.girls.filter(item => !item.dead && !item.retired).length;
      default:
        return 0;
    }
  })();
  switch (condition.op) {
    case '<': return value < condition.value;
    case '<=': return value <= condition.value;
    case '>': return value > condition.value;
    case '>=': return value >= condition.value;
    case '==': return value === condition.value;
    default: return false;
  }
}

function maxGirl(state: GameState, field: 'bond' | 'fatigue') {
  const alive = state.girls.filter(item => !item.dead && !item.retired);
  return [...alive].sort((a, b) => b[field] - a[field])[0];
}

function dirtyDistrictId(state: GameState): DistrictId {
  return dirtiestDistrict(state).id;
}

/** 把模板里的 {district} {girl} {faction} {envoy} 换成这一局真实的名字。 */
export function fillIncidentText(state: GameState, template: IncidentTemplate, at: { day: number; minutes: number }) {
  const context = conditionContext(template.trigger);

  const girl = context.girlId
    ? state.girls.find(item => item.id === context.girlId && !item.dead && !item.retired)
    : pickByHash(state.girls.filter(item => !item.dead && !item.retired && item.bond >= 30), `${template.id}:${at.day}`);
  const factionId: FactionId = context.faction
    ?? pickByHash(Object.keys(factionInfo) as FactionId[], `${template.id}:${at.day}`)
    ?? 'association';
  const districtId: DistrictId = context.district ?? dirtyDistrictId(state);

  const replace = (text: string) => text
    .replaceAll('{girl}', girl?.name ?? '当班的少女')
    .replaceAll('{faction}', factionInfo[factionId].name)
    .replaceAll('{envoy}', representativeNameOf(state, factionId))
    .replaceAll('{district}', districts[districtId]?.name ?? '辖区');

  return {
    title: replace(template.title),
    body: replace(template.body),
    girlId: template.body.includes('{girl}') || template.title.includes('{girl}') ? girl?.id : undefined,
    faction: template.body.includes('{faction}') || template.body.includes('{envoy}') ? factionId : undefined,
    district: template.body.includes('{district}') ? districtId : undefined,
  };
}

function conditionContext(trigger: IncidentTrigger) {
  const all = trigger.kind === 'condition' ? trigger.all : [];
  return {
    faction: all.find(item => item.field === 'faction')?.faction,
    district: all.find(item => item.district)?.district,
    girlId: all.find(item => item.girlId)?.girlId,
  };
}

/** 把模板快照成一条真正的 Incident；之后的选项效果都落在这份快照上。 */
export function makeIncidentFromTemplate(
  state: GameState,
  template: IncidentTemplate,
  at: { day: number; minutes: number },
): Incident {
  const filled = fillIncidentText(state, template, at);
  const ttl = template.ttlMinutes ?? INCIDENT_DEFAULT_TTL;
  state.incidentSeq = (state.incidentSeq ?? 0) + 1;
  return {
    id: `inc-${at.day}-${state.incidentSeq}`,
    day: at.day,
    kind: template.kind ?? (template.category === 'scene' ? 'girl' : 'faction'),
    source: 'rule',
    title: filled.title,
    body: filled.body,
    faction: filled.faction,
    girlId: filled.girlId,
    district: filled.district,
    options: template.options.map(option => ({ ...option })),
    status: 'pending',
    category: template.category,
    trigger: template.trigger,
    ttlMinutes: ttl,
    expiresAt: incidentMinute(at.day, at.minutes) + ttl,
    scene: template.scene ? { ...template.scene, lines: template.scene.lines.map(line => ({ ...line })) } : undefined,
    templateId: template.id,
  };
}

function triggerMatches(trigger: IncidentTrigger, cause: 'dayStart' | 'wave' | 'missionDone', wave: number, work?: WorkKind) {
  if (trigger.kind === 'condition') return true;
  if (trigger.kind !== cause) return false;
  if (trigger.kind === 'wave') return wave >= trigger.wave;
  if (trigger.kind === 'missionDone') return !trigger.work || trigger.work === work;
  return true;
}

function onCooldown(state: GameState, template: IncidentTemplate, day: number) {
  const last = state.incidentCooldowns?.[template.id];
  if (typeof last !== 'number') return false;
  return day - last < (template.cooldownDays ?? INCIDENT_DEFAULT_COOLDOWN);
}

export interface DueOptions {
  /** 敌意值进到摩擦档以后由 game.ts 打开，把战争预兆也纳入投放。 */
  includeWarSignals?: boolean;
  wave?: number;
  work?: WorkKind;
}

/**
 * 纯筛选：返回这一次触发应该投放的事件（已经过条件、冷却、待处理上限）。
 * 不写日志、不改状态，调用方拿到结果后再塞进 state.incidents。
 */
export function dueIncidents(
  state: GameState,
  cause: 'dayStart' | 'wave' | 'missionDone',
  at: { day: number; minutes: number },
  options: DueOptions = {},
): Incident[] {
  if (blockingIncidents(state).length >= INCIDENT_PENDING_LIMIT) return [];
  const wave = options.wave ?? state.shift.wave;
  const pool: IncidentTemplate[] = [...builtinIncidents];
  if (options.includeWarSignals) pool.push(...warSignalTemplates);

  const ready = pool.filter(template => {
    if (!triggerMatches(template.trigger, cause, wave, options.work)) return false;
    if (template.trigger.kind === 'condition' && !template.trigger.all.every(condition => conditionMet(state, condition))) return false;
    if (onCooldown(state, template, at.day)) return false;
    if (state.incidents.some(item => item.templateId === template.id && item.status === 'pending')) return false;
    return !state.incidentPool.some(item => item.templateId === template.id);
  });
  if (!ready.length) return [];

  // 战争预兆一次只投一条，而且优先；平时按 (day, 模板 id) 哈希轮换，避免同一天总是同一条。
  const warSignal = ready.filter(template => (template.priority ?? 0) >= 10)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  const chosen = warSignal ?? pickByHash(ready.filter(template => (template.priority ?? 0) < 10).sort((a, b) => hashText(`${a.id}:${at.day}`) - hashText(`${b.id}:${at.day}`)), `${cause}:${at.day}:${at.minutes}`);
  if (!chosen) return [];
  return [makeIncidentFromTemplate(state, chosen, at)];
}

/**
 * 这一次触发到底投哪条：先问内置模板，没有合适的再从**模型写的待用池**里取。
 *
 * 池子以前只进不出——`takeFromPool` 一个调用方都没有，模型写好的弹窗永远躺在
 * `state.incidentPool` 里，玩家一次也看不到。现在三条触发路径（开门 / 每个时段 / 委托收尾）
 * 都走这里，内置优先，池子兜底。
 */
export function deployDueIncident(
  state: GameState,
  cause: 'dayStart' | 'wave' | 'missionDone',
  at: { day: number; minutes: number },
  options: DueOptions = {},
): Incident | undefined {
  const [builtin] = dueIncidents(state, cause, at, options);
  if (builtin) return builtin;
  const pooled = takeFromPool(state, cause, at, options);
  return pooled ? { ...pooled, status: 'pending' } : undefined;
}

/** 到点没处理的弹窗标记成过期，交给调用方结算代价。 */
export function expireIncidents(state: GameState, at: { day: number; minutes: number }): Incident[] {
  const now = incidentMinute(at.day, at.minutes);
  const expired: Incident[] = [];
  for (const incident of state.incidents) {
    if (incident.status !== 'pending') continue;
    if (typeof incident.expiresAt !== 'number' || incident.expiresAt > now) continue;
    incident.status = 'expired';
    incident.expiredBy = 'time';
    expired.push(incident);
  }
  return expired;
}

/** 只保留待处理，其余迁出；用于超上限时把多出来的退回池子。 */
export function trimIncidents(state: GameState) {
  const pending = incidentPending(state);
  if (pending.length <= INCIDENT_PENDING_LIMIT) return [];
  const overflow = pending.slice(INCIDENT_PENDING_LIMIT);
  const overflowIds = new Set(overflow.map(item => item.id));
  state.incidents = state.incidents.filter(item => !overflowIds.has(item.id));
  state.incidentPool = [...state.incidentPool, ...overflow.map(item => ({ ...item, status: 'pending' as const }))];
  return overflow;
}

/** 池子还差多少条，用于决定这一晚要不要叫叙事者补稿。 */
export function incidentPoolNeed(state: GameState) {
  const fresh = builtinIncidents.filter(template => !onCooldown(state, template, state.day)).length;
  return Math.max(0, INCIDENT_POOL_CAP - (state.incidentPool.length + fresh));
}

/** 没有叙事者/模型失败时，用没冷却过的内置模板把池子填到至少 3 条。 */
export function topUpFromFallback(state: GameState, at: { day: number; minutes: number }, want = 3): Incident[] {
  const added: Incident[] = [];
  const usable = builtinIncidents
    .filter(template => !onCooldown(state, template, at.day))
    .filter(template => !state.incidentPool.some(item => item.templateId === template.id))
    .filter(template => !state.incidents.some(item => item.templateId === template.id && item.status === 'pending'))
    .sort((a, b) => hashText(`${a.id}:${at.day}`) - hashText(`${b.id}:${at.day}`));
  for (const template of usable) {
    if (state.incidentPool.length >= want) break;
    added.push(makeIncidentFromTemplate(state, template, at));
  }
  state.incidentPool = [...state.incidentPool, ...added];
  return added;
}

/** 从池子里取一条符合条件的投放；取不到就返回 undefined。 */
export function takeFromPool(state: GameState, cause: 'dayStart' | 'wave' | 'missionDone', at: { day: number; minutes: number }, options: DueOptions = {}) {
  const wave = options.wave ?? state.shift.wave;
  const index = state.incidentPool.findIndex(incident => {
    const trigger = incident.trigger;
    if (!trigger) return true;
    return triggerMatches(trigger, cause, wave, options.work);
  });
  if (index === -1) return undefined;
  const [incident] = state.incidentPool.splice(index, 1);
  return { ...incident, day: at.day, expiresAt: incidentMinute(at.day, at.minutes) + (incident.ttlMinutes ?? INCIDENT_DEFAULT_TTL) };
}

/** 记一条模板的冷却时间；投放时调用。 */
export function markIncidentCooldown(state: GameState, incident: Incident) {
  if (!incident.templateId) return;
  state.incidentCooldowns = { ...state.incidentCooldowns, [incident.templateId]: incident.day };
}

export function incidentOptionById(incident: Incident, id: string): IncidentOption | undefined {
  return incident.options.find(option => option.id === id);
}

/**
 * 模型写的触发条件。四选一：开门 / 某个时段 / 某类委托收尾 / 条件式。
 * 没写或写坏就按类别推导——通报放开门前，要拿主意的丢进时段，剧情挂在委托之后，
 * 这样条目至少有一个能真的触发的时机，而不是进池子就再也不出来。
 */
function incidentTriggerFrom(raw: unknown, category: Incident['category']): IncidentTrigger {
  if (raw && typeof raw === 'object') {
    const value = raw as Record<string, unknown>;
    if (value.kind === 'dayStart') return { kind: 'dayStart' };
    if (value.kind === 'wave') {
      const wave = Number(value.wave);
      return { kind: 'wave', wave: Number.isFinite(wave) ? Math.max(0, Math.min(2, Math.round(wave))) : 1 };
    }
    if (value.kind === 'missionDone') {
      const work = value.work === 'combat' || value.work === 'investigation' ? value.work as WorkKind : undefined;
      const district = typeof value.district === 'string' && value.district in districts ? value.district as DistrictId : undefined;
      return { kind: 'missionDone', work, district };
    }
    if (value.kind === 'condition' && Array.isArray(value.all) && value.all.length) {
      const all = value.all.filter((entry): entry is IncidentCondition => Boolean(entry) && typeof entry === 'object').slice(0, 3);
      if (all.length) return { kind: 'condition', all };
    }
  }
  if (category === 'decision') return { kind: 'wave', wave: 1 };
  if (category === 'scene') return { kind: 'missionDone' };
  return { kind: 'dayStart' };
}

/** 把模型给的条目洗成可以进池子的弹窗：文本长度、选项数量、数值幅度都夹住，不合格的直接丢。 */
export function sanitizeGeneratedIncident(
  state: GameState,
  raw: unknown,
  at: { day: number; minutes: number },
): Incident | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  const title = typeof item.title === 'string' ? item.title.trim().slice(0, 24) : '';
  const body = typeof item.body === 'string' ? item.body.trim().slice(0, 220) : '';
  if (title.length < 2 || body.length < 16) return undefined;
  const rawCategory = item.category;
  const category: Incident['category'] = rawCategory === 'report' || rawCategory === 'decision' || rawCategory === 'scene' ? rawCategory : undefined;
  const rawOptions = Array.isArray(item.options) ? item.options.filter(option => option && typeof option === 'object').slice(0, 3) : [];
  const options: IncidentOption[] = [];
  for (const [index, option] of rawOptions.entries()) {
    const entry = option as Record<string, unknown>;
    const label = typeof entry.label === 'string' ? entry.label.trim().slice(0, 14) : '';
    if (label.length < 1) continue;
    const hint = typeof entry.hint === 'string' ? entry.hint.trim().slice(0, 40) : '';
    const effect: IncidentOption['effect'] = {};
    const rawEffect = entry.effect && typeof entry.effect === 'object' ? entry.effect as Record<string, unknown> : {};
    const clamp = (value: unknown, min: number, max: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : 0);
    const gold = clamp(rawEffect.gold, -1200, 1200);
    if (gold) effect.gold = gold;
    const reputation = clamp(rawEffect.reputation, -6, 6);
    if (reputation) effect.reputation = reputation;
    const rawFaction = rawEffect.faction && typeof rawEffect.faction === 'object' ? rawEffect.faction as Record<string, unknown> : undefined;
    if (rawFaction) {
      const id = rawFaction.id;
      const standing = clamp(rawFaction.standing, -6, 6);
      if ((id === 'association' || id === 'government' || id === 'witch') && standing) effect.faction = { id, standing };
    }
    const rawGirl = rawEffect.girl && typeof rawEffect.girl === 'object' ? rawEffect.girl as Record<string, unknown> : undefined;
    if (rawGirl) {
      const bond = clamp(rawGirl.bond, -6, 6);
      const spirit = clamp(rawGirl.spirit, -8, 8);
      const fatigue = clamp(rawGirl.fatigue, -10, 10);
      if (bond || spirit || fatigue) effect.girl = { ...(bond ? { bond } : {}), ...(spirit ? { spirit } : {}), ...(fatigue ? { fatigue } : {}) };
    }
    options.push({ id: `o${index + 1}`, label, hint, effect });
  }
  const finalCategory: Incident['category'] = category ?? (options.length >= 2 ? 'decision' : 'report');
  if (finalCategory === 'scene' && options.length === 0) {
    // 剧情型弹窗不需要选项，但要有一段可以看的场景。
    const scene = item.scene && typeof item.scene === 'object' ? item.scene as Record<string, unknown> : undefined;
    void scene;
  }
  const rawGirlId = typeof item.girlId === 'string' ? item.girlId.trim() : '';
  const resolvedGirl = rawGirlId && state.girls.some(girl => girl.id === rawGirlId && !girl.dead) ? rawGirlId : undefined;
  const declaredKind = item.kind === 'faction' || item.kind === 'environment' || item.kind === 'girl' ? item.kind : undefined;
  // 说是「关于某个少女」，但 id 不在名册上：降级成环境事件，别留一条永远点不着 girlId 的弹窗。
  const kind: Incident['kind'] = declaredKind === 'girl'
    ? (resolvedGirl ? 'girl' : 'environment')
    : declaredKind ?? (finalCategory === 'scene' ? (resolvedGirl ? 'girl' : 'environment') : 'faction');
  const rawDistrict = typeof item.district === 'string' && item.district in districts ? item.district as DistrictId : undefined;
  const rawFactionId = item.faction === 'association' || item.faction === 'government' || item.faction === 'witch' ? item.faction : undefined;
  const trigger = incidentTriggerFrom(item.trigger, finalCategory);
  const ttlRaw = typeof item.ttlMinutes === 'number' && Number.isFinite(item.ttlMinutes) ? Math.round(item.ttlMinutes) : INCIDENT_DEFAULT_TTL;
  const ttl = Math.max(60, Math.min(480, ttlRaw));
  const stamp = hashText(`${title}:${body}`).toString(36);
  return {
    id: `inc-pool-${stamp}`,
    day: at.day,
    kind,
    source: 'llm',
    title,
    body,
    options: finalCategory === 'report' ? [] : options,
    status: 'pending',
    category: finalCategory,
    trigger,
    girlId: kind === 'girl' ? resolvedGirl : undefined,
    faction: kind === 'faction' ? rawFactionId : undefined,
    district: rawDistrict,
    ttlMinutes: ttl,
    expiresAt: incidentMinute(at.day, at.minutes) + ttl,
    templateId: `llm-${stamp}`,
  };
}

/** 把一批模型生成的条目并进待用池：去重、夹上限，返回真正进去的条数。 */
export function mergeIncidentPool(state: GameState, raws: unknown[], at: { day: number; minutes: number }): number {
  const existing = new Set(state.incidentPool.map(item => item.templateId).filter(Boolean));
  const fresh: Incident[] = [];
  const room = Math.max(0, INCIDENT_POOL_CAP - state.incidentPool.length);
  for (const raw of raws) {
    if (fresh.length >= room) break;
    const incident = sanitizeGeneratedIncident(state, raw, at);
    if (!incident?.templateId || existing.has(incident.templateId)) continue;
    existing.add(incident.templateId);
    fresh.push(incident);
  }
  if (!fresh.length) return 0;
  state.incidentPool = [...state.incidentPool, ...fresh];
  return fresh.length;
}

/**
 * 该主动弹出来的那一条：先看必须立刻决定的，再看还没被「稍后再说」推迟的。
 *
 * 以前只有 blocking 的会自己弹，于是叙事者拟的非阻塞事件全都沉在任务列表里，
 * 玩家不点就永远看不到——事件白生成了。
 */
export function openIncidentFor(state: GameState, deferred: readonly string[] = []): Incident | undefined {
  const blocking = blockingIncidents(state);
  if (blocking.length) return blocking[0];
  return state.incidents
    .filter(incident => incident.status === 'pending' && !deferred.includes(incident.id))
    .at(-1);
}
