/**
 * 世界书：与 SillyTavern 的 World Info 同构的词条集合。
 * 常驻词条每次注入；其余按关键词命中注入，总预算默认 1200 字。
 */
import type { Girl, OfficeProfile } from './types.ts';
import { DEFAULT_OFFICE_PROFILE, OFFICE_WORLDBOOK_ID, officeWorldbookContent, sanitizeOfficeProfile } from './office.ts';

export interface WorldbookEntry {
  id: string;
  name: string;
  keys: string[];
  content: string;
  enabled: boolean;
  constant: boolean;
  priority: number;
  order: number;
  comment?: string;
  builtin?: boolean;
  /** 由游戏状态生成、不允许手改的词条（目前只有事务所档案）。 */
  generated?: boolean;
}

export const WORLDBOOK_KEY = 'night-sugar:worldbook';
export const WORLDBOOK_BUDGET = 1600;
/** 事务所档案变化时广播，世界书页收到后重新读取，不必等页面重挂。 */
export const WORLDBOOK_EVENT = 'night-sugar:worldbook';

function entry(
  id: string, name: string, content: string,
  options: { keys?: string[]; constant?: boolean; priority?: number; order?: number } = {},
): WorldbookEntry {
  return {
    id, name, content: content.trim(), keys: options.keys ?? [], enabled: true,
    constant: options.constant ?? false, priority: options.priority ?? 50,
    order: options.order ?? 0, builtin: true,
  };
}

/** 事务所档案的生成条目；每次读世界书都用当前档案重算，不落一份副本。 */
export function officeWorldbookEntry(profile?: OfficeProfile | null, representative?: Girl): WorldbookEntry {
  return {
    id: OFFICE_WORLDBOOK_ID,
    name: '夜糖事务所',
    keys: ['夜糖事务所', '事务所', '背景', '理念', '目标', '对外代表'],
    content: officeWorldbookContent(sanitizeOfficeProfile(profile ?? DEFAULT_OFFICE_PROFILE), representative),
    enabled: true,
    constant: true,
    priority: 92,
    order: 4,
    comment: '由事务所档案自动生成，修改请到基础页的事务所档案',
    builtin: true,
    generated: true,
  };
}

export function builtinWorldbook(): WorldbookEntry[] {
  return [
    entry('moon', '空月', '【终焉】空月不是天体，是所有魔法少女的祈愿与绝望叠起来的那一轮月亮。它盈满的那一刻，也正是它开始亏的那一刻——缺下去的那一块不是影子，是它张开的嘴：它饥饿地吞掉一切魔法来源，从最弱的那颗星开始。\n\n【对抗史】三方曾经真的一起打过它。星灯协会交出过名录上最好的名字，市役所把整队量产编号填进钟楼的裂缝，月蚀庭烧掉了自己一半的配方。每一次都只把它按回去一会儿，代价一次次叠高，高到没有人敢再算总账。\n\n【现在的办法】三方不再谈胜利，只谈延期。按份额献祭魔法少女——协会出登记者，市役所出编号，月蚀庭出未受洗的孩子——用她们的愿望把它哄睡。封印有期限，到期就会松动，松动到撑不住的时候，钟楼上方的月亮就少一块。\n\n【写法提醒】空月不说话，也不谈判，没有代理人。别把它写成会讲条件的反派；提到它时写月相、饥饿、账本和名字，不要写它的台词。', { constant: true, priority: 96, order: 0 }),
    officeWorldbookEntry(),
    entry('wound', '生命与受伤', '血量上限由体质与等级决定，当前血量低于上限时行动会变慢。血量低于 25 的契约者不能派遣；战斗中倒下会留下疤痕，第五道疤痕意味着退役或死亡。疤痕不会自动消失，只能通过时间与照顾慢慢适应。', { constant: true, priority: 95, order: 1 }),
    entry('bond', '共情与羁绊', '共情值是契约者的精神耐久，出勤、受伤与深夜谈话都会消耗它。共情见底时她会拒绝深入的话题，但不会立刻离开。羁绊是关系的刻度，20 点可以开始一条个人故事线，60 点以后她会主动谈起自己的过去。', { keys: ['共情', '羁绊', '关系', '亲近', '好感'], priority: 80, order: 2 }),
    entry('corruption', '侵蚀与魔女化', '每次使用魔法都会累积侵蚀。侵蚀越高，立绘与语气越接近魔女；越过阈值后可以显形魔女化礼装，属性提高，但共情消耗加快。侵蚀不可逆，只能靠休息与陪伴放慢。', { constant: true, keys: ['侵蚀', '魔女', '魔女化', '异变'], priority: 90, order: 3 }),
    entry('gold', '星砂与安定度', '星砂是事务所的货币，用来签约、扩建、治疗与采购。安定度是城市对事务所的信任，影响候选者质量、势力态度与委托报酬；太低时会出现拒单与盘查。两者都不该凭空出现或消失。', { constant: true, priority: 85, order: 5 }),
    entry('factions', '三方势力', '星灯协会是官方登记机构，讲程序、要报告，名录上每一条名字都要有人负责；市役所管着城市的日常与夜禁，最在意不出事，手里握着成队的量产编号；月蚀庭不问出身，只问价钱，相信魔法少女是通往另一侧的桥，出手阔绰、条件危险。三方各占九块辖区中的若干块，辖区归属会影响委托的目标与报酬。三方过去曾一起对抗空月，如今只谈延期与份额。', { constant: true, priority: 85, order: 6 }),
    entry('shift', '夜班规则', '事务所 20:00 开门、次日 02:00 打烊，午夜之后仍算同一夜。委托分三批放出（20:00 / 22:00 / 00:00），紧急委托两小时内不接就会撤销，长期委托可以跨夜。打烊前必须处理完桌上的强制事件。', { constant: true, priority: 90, order: 7 }),
    entry('districts', '九块辖区', '星见川把城市分成两岸：西北是糖果公园，北岸是桥头，东北是月见台，东中是玻璃温室，东南河岸是旧教堂，再往东南是南十字；西边最大的是旧城区，中西部是旧钟楼，西南沿河是码头。每块辖区都有自己的地形修正。', { keys: ['辖区', '地图', '区域', '糖果公园', '星见川', '旧城区', '码头', '教堂'], priority: 70, order: 8 }),
    entry('missions', '委托与时限', '委托分调查与战斗两类。调查看契合度与属性，战斗按回合结算。紧急委托的目标更低但时限短，长期委托报酬更高、可以跨夜。故事线委托不参与打烊清理，完成它才会推进剧情。', { constant: true, priority: 80, order: 9 }),
    entry('council', '议会', '会客厅里，月蚀、星灯与市役所的代表轮流提出议题。议题通常要钱、要人、要辖区，也可能只是试探。批准会改变辖区或预算，驳回会降低关系，暂缓只是把决定往后推。', { keys: ['议会', '会客厅', '议题', '代表', '决议'], priority: 65, order: 10 }),
    entry('dorm', '宿舍', '宿舍负责恢复疲劳。等级越高，每晚恢复得越多，也能容纳更多契约者。疲劳高于 80 时不能派遣；连续出勤会让恢复变慢。', { keys: ['宿舍', '疲劳', '休息', '床位'], priority: 60, order: 11 }),
    entry('clinic', '诊所与治疗', '诊所按缺失的血量收费，按小时恢复，不再处理疲劳。治疗期间不能派遣，也不能参加议会。伤势越重，费用越高、时间越长。', { keys: ['诊所', '治疗', '受伤', '手术'], priority: 60, order: 12 }),
    entry('kink', '治疗癖好', '有些人会在被照顾时放松下来。选择带癖好的治疗会更贵、更久，但结束时羁绊上升、侵蚀也会上升；已经拥有「治疗癖好」的人再次接受时，效果更强。', { keys: ['癖好', '治疗癖好'], priority: 55, order: 13 }),
    entry('story', '故事线', '每位契约者同时只能有一条故事线。故事线由若干幕组成，每一幕给出一个明确的任务目标；完成委托后触发该幕的特殊事件，事件结束才会解锁下一幕。故事线可以跨夜保留。', { keys: ['故事线', '剧情', '羁绊事件', '特殊事件'], priority: 70, order: 14 }),
    entry('battle-note', '战斗札记', '战斗结束后可以把战斗日志扩写成一篇札记：按回合写清发生了什么、谁救了谁、谁退缩了。札记会作为后续剧情的上下文，所以它必须与战斗记录一致。', { keys: ['战斗', '札记', '战斗记录', '回合'], priority: 55, order: 15 }),
  ];
}

export function sanitizeWorldbookEntry(raw: unknown, index: number): WorldbookEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const content = typeof value.content === 'string' ? value.content.slice(0, 4000) : '';
  if (!content.trim()) return null;
  const keys = Array.isArray(value.keys)
    ? value.keys.filter((key): key is string => typeof key === 'string' && Boolean(key.trim())).map(key => key.trim().slice(0, 24)).slice(0, 12)
    : Array.isArray(value.key)
      ? value.key.filter((key): key is string => typeof key === 'string' && Boolean(key.trim())).map(key => key.trim().slice(0, 24)).slice(0, 12)
      : [];
  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim().slice(0, 40)
    : typeof value.comment === 'string' && value.comment.trim() ? value.comment.trim().slice(0, 40) : `词条 ${index + 1}`;
  return {
    id: typeof value.uid === 'string' ? value.uid : typeof value.id === 'string' && value.id ? value.id : typeof value.uid === 'number' ? `wb-${value.uid}` : `wb-${index}-${Date.now().toString(36)}`,
    name,
    keys,
    content,
    enabled: value.disable === true ? false : value.enabled !== false,
    constant: value.constant === true,
    priority: typeof value.priority === 'number' ? Math.min(100, Math.max(0, Math.round(value.priority))) : 50,
    order: typeof value.order === 'number' ? Math.min(999, Math.max(-999, Math.round(value.order))) : index + 1,
    comment: typeof value.comment === 'string' ? value.comment.slice(0, 80) : undefined,
    builtin: Boolean(value.builtin),
    // 自动生成的词条在 UI 里只读；这条标记必须活过存取，否则刷新一次就能手改。
    generated: value.generated === true,
  };
}

export function loadWorldbook(): WorldbookEntry[] {
  const builtins = builtinWorldbook();
  try {
    const raw = localStorage.getItem(WORLDBOOK_KEY);
    if (!raw) return builtins;
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown[] }).entries) ? (parsed as { entries: unknown[] }).entries : null;
    if (!list) return builtins;
    const custom = list.map((item, index) => sanitizeWorldbookEntry(item, index)).filter((item): item is WorldbookEntry => Boolean(item));
    return custom.length ? custom : builtins;
  } catch {
    return builtins;
  }
}

export function saveWorldbook(entries: WorldbookEntry[]): boolean {
  try {
    localStorage.setItem(WORLDBOOK_KEY, JSON.stringify(entries.slice(0, 80)));
    return true;
  } catch {
    return false;
  }
}

export function defaultWorldbook(): WorldbookEntry[] {
  return builtinWorldbook().map(item => ({ ...item, enabled: item.constant }));
}

const LEGACY_FACTION_NAME = '月蚀教团';
const FACTION_NAME = '月蚀庭';

/**
 * 把事务所档案同步成世界书里的生成条目。
 * 事实来源是 `state.office` 与 `state.assistantId`，这里只负责写副本，不反向读取。
 * `onlyIfMissing` 用于首次挂载：只补缺失条目，不覆盖玩家已经看到的内容。
 */
export function syncOfficeWorldbook(
  profile: OfficeProfile | null | undefined,
  representative?: Girl,
  options: { onlyIfMissing?: boolean } = {},
): boolean {
  const entries = loadWorldbook();
  const fresh = officeWorldbookEntry(profile, representative);
  const hasEntry = entries.some(item => item.id === OFFICE_WORLDBOOK_ID);
  let changed = false;
  const updated = entries.map(item => {
    if (item.id === OFFICE_WORLDBOOK_ID) {
      if (options.onlyIfMissing) return item;
      if (item.content === fresh.content && item.name === fresh.name) return item;
      changed = true;
      return { ...item, ...fresh, keys: item.keys.length ? item.keys : fresh.keys, enabled: item.enabled };
    }
    if (item.content.includes(LEGACY_FACTION_NAME)) {
      changed = true;
      return { ...item, content: item.content.split(LEGACY_FACTION_NAME).join(FACTION_NAME) };
    }
    return item;
  });
  if (!hasEntry) {
    updated.unshift(fresh);
    changed = true;
  }
  if (!changed) return true;
  const ok = saveWorldbook(updated);
  if (ok && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(WORLDBOOK_EVENT));
    } catch {
      /* 隐私模式下 dispatch 也可能抛错，写盘已成功就不影响使用 */
    }
  }
  return ok;
}

export interface WorldbookContext {
  text: string;
  hits: { id: string; name: string; reason: 'constant' | 'key' }[];
  tokens: number;
  dropped: number;
}

/** 常驻 + 关键词命中的词条；按 priority 降序、order 升序装进预算。 */
export function worldbookContext(trigger: string, entries = loadWorldbook(), budget = WORLDBOOK_BUDGET): WorldbookContext {
  const haystack = trigger.toLowerCase();
  const active = entries.filter(item => item.enabled);
  const scored = active.map(item => {
    const keyHit = item.keys.find(key => key && haystack.includes(key.toLowerCase()));
    const hit = item.constant ? 'constant' : keyHit ? 'key' : null;
    return { item, hit };
  }).filter((row): row is { item: WorldbookEntry; hit: 'constant' | 'key' } => Boolean(row.hit));
  scored.sort((a, b) => b.item.priority - a.item.priority || a.item.order - b.item.order);
  const parts: string[] = [];
  const hits: WorldbookContext['hits'] = [];
  let used = 0;
  let dropped = 0;
  for (const { item, hit } of scored) {
    const block = `### ${item.name}\n${item.content}`;
    if (used + block.length > budget) { dropped += 1; continue; }
    parts.push(block);
    hits.push({ id: item.id, name: item.name, reason: hit });
    used += block.length;
  }
  return { text: parts.join('\n\n'), hits, tokens: Math.ceil(used / 2), dropped };
}

export interface WorldbookImportResult {
  ok: boolean;
  message: string;
  entries?: WorldbookEntry[];
}

export function importWorldbookJson(source: string): WorldbookImportResult {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return { ok: false, message: '不是合法的 JSON。' };
  }
  const record = data as { entries?: unknown; name?: string };
  const rawList = Array.isArray(data)
    ? data
    : record?.entries
      ? Array.isArray(record.entries) ? record.entries : Object.values(record.entries as Record<string, unknown>)
      : null;
  if (!rawList) return { ok: false, message: '没有找到 entries；请选择 SillyTavern 世界书导出的 JSON。' };
  const entries = (rawList as unknown[]).map((item, index) => sanitizeWorldbookEntry(item, index)).filter((item): item is WorldbookEntry => Boolean(item));
  if (!entries.length) return { ok: false, message: '词条都为空或缺少 content。' };
  return { ok: true, message: `已导入 ${entries.length} 条词条。`, entries };
}

export function exportWorldbookJson(entries: WorldbookEntry[]): string {
  const map: Record<string, unknown> = {};
  entries.forEach((item, index) => {
    map[String(index)] = {
      uid: index, key: item.keys, comment: item.name, content: item.content,
      constant: item.constant, disable: !item.enabled, order: item.order, priority: item.priority,
    };
  });
  return JSON.stringify({ entries: map, name: '夜糖事务所 · 世界书' }, null, 2);
}

export const WORLDBOOK_PLACEHOLDER = '{{worldbook}}';
