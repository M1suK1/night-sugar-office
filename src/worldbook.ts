/**
 * 世界书：与 SillyTavern 的 World Info 同构的词条集合。
 * 常驻词条每次注入；其余按关键词命中注入，总预算默认 1900 字。
 */
import { kvGet, kvSet } from './store.ts';
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
export const WORLDBOOK_BUDGET = 1900;
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
    entry('moon', '空月', '【终焉】空月不是自然天体，是整座城市所有契约者在长夜里，将无数次虚妄祈愿与濒死绝望相互叠压而成的庞大蚀核。当冷白月轮盈满时巨口张开，带着永无止境的饥饿剥离并汲取全城魔力回路，先从呼吸最微弱的星辰吞吃。\n\n【对抗史】崩溃年代三方曾联手抗击月相：协会抹去名录受洗者，市役所将量产编号填入钟楼裂缝，月蚀庭焚毁半数秘药配方。惨烈合力仅换来片刻苟延残喘，代价逐年攀升，直至三方不敢再核算总账。\n\n【现在的办法】如今三方放弃彻底净化的幻想，转向代价分摊与周期延缓：按精密协议定额共同献祭契约者的神智愿力，协会出登记者，市役所出量产编号，月蚀庭出未受洗新血，以此抚平空月狂躁。然而封印终会松动，每当钟楼月相又被撕咬去一角，长夜清算便再度降临。\n\n【写法提醒】空月不具备拟人意识，从不谈判亦无现世代理人。切勿将其写为具象反派；提及它时仅聚焦于冷月虚光、魔力汲取、阵亡账本与空洞名字，严禁编写任何台词。', { constant: true, priority: 96, order: 0 }),
    officeWorldbookEntry(),
    entry('wound', '生命与受伤', '契约者的肉体终究无法无休止承载法蚀撕扯，承受力上限由体格与历战磨砺锚定；一旦深陷重创，神经与肢体机能便会迟滞。当生命刻度跌破危险阈值（25点）时必须强制停勤——在深夜异象中失控倒下，不仅撕开皮肉，更会在灵魂与现世的接缝处留下不可逆的深层疤痕；第五道疤痕是绝不可触碰的危险红线，预示着退役终局或肉躯被夜雾分解。伤痕无法自愈，唯有在漫长照料中慢慢适应。', { constant: true, priority: 95, order: 1 }),
    entry('bond', '共情与羁绊', '共情是契约者精神世界的弹性与张力指标，它直接构筑起抵御精神冲击的心防屏障厚度，亦在潜意识里划定了她面对外界时允许展露的防备边界。而羁绊则是彼此在漫长夜巡与烛火对坐中沉淀出的信任刻度：当默契累积至20点，她便会默许你涉入其封尘的故事节点，共同解开命运的锁扣；当数值攀升至60点以上，那些在白昼绝口不提的旧伤、执念与身世隐秘，才会在无人的深夜桌前，化为坦诚托出的低语。', { keys: ['共情', '羁绊', '关系', '亲近', '好感'], priority: 80, order: 2 }),
    entry('guard', '心防', '心防是契约者调动共情在神智外围撑起的无形偏折屏障；恶意冲击落在肉体前，都先被这层意志层层滤过。共情越丰沛心防越坚韧，礼装可增补结构，而疤痕与疲惫则会削弱其厚度。\n\n【完好时】如一面柔韧缓冲壁，将直击创伤削去三成锐度，使契约者在受袭时仍能稳住身形并冷静对答。\n\n【被打穿】碎裂瞬间伴随强烈眩晕，契约者将陷入整轮失衡踉跄，当夜无法重聚护持；此后落下的攻击将毫无阻隔凿进皮肉。\n\n【第二天】伴随天光与深层休眠，防护膜方能重新长满——除非创痛过深留下了精神疤痕。\n\n【败法】全员踉跄或倒伏即告败北；此类溃败最易留下精神重创，通常需前往诊所实施代价昂贵的记忆重塑术式，连等级与成长一起推回起点，才能抹去后遗症。', { constant: true, keys: ['心防', '护持', '打穿', '踉跄'], priority: 84, order: 2 }),
    entry('corruption', '侵蚀与魔女化', '每一次调动超越常理的魔力，灵魂底层都会渗出焦黑的法蚀残渣。随着污染加深，契约者的神态、眼底波光与言辞都会偏向乖戾多疑的魔女特质；越过临界阈值后虽能显化魔女礼装换取爆发战力，却会使共情加速过载磨损。法蚀轨迹不可逆转，唯靠规律休整与长久陪伴方能延缓深渊合拢。', { constant: true, keys: ['侵蚀', '魔女', '魔女化', '异变'], priority: 90, order: 3 }),
    entry('gold', '星砂与安定度', '星砂是樱雾市地下暗流中通行的实质等价物，由净化结晶提炼而成，维系着事务所签约、扩建、外科救治与采购的流水。安定度是城市对事务所的信赖刻度，不仅左右着优质契约者引荐、各方态度与报酬溢价，滑落至警戒线下更会招致巡警盘查与市民拒单。两项资源皆源于长夜中的实际付出，绝不凭空生灭。', { constant: true, priority: 85, order: 5 }),
    entry('factions', '三方势力', '星灯协会是掌握法理的古老登记中枢，严守程序报告，执着于名录上的名字皆须有人问责；市役所管辖市政秩序与宵禁防线，最在乎维持报表平稳，握有成批配给的量产克隆编号；月蚀庭隐于旧教堂地窖深处，不问出身唯认价码，笃信魔法少女是通向彼岸的阶梯，出手阔绰却伴随致命代价。三方割据九大辖区，曾合力抗击空月，如今却只剩下对献祭份额的冷酷拉锯。', { constant: true, priority: 85, order: 6 }),
    entry('shift', '夜班规则', '事务所执勤窗口始于晚间八点（20:00），终于次日凌晨两点（02:00），午夜之后直至破晓仍归属同一工作夜。城中委托分三批投放（20:00、22:00与午夜），紧急委托若两小时内未被领受便会被撤回并招致恶果，唯有长期委托允许跨夜持续追踪。在打烊锁门之前，值班桌上堆积的强制事件必须处置完毕，长夜阴影方可折叠封存。', { constant: true, priority: 90, order: 7 }),
    entry('districts', '九块辖区', '冰冷湍急的星见川将樱雾市劈为东西两岸：西北侧是充满欢笑幻影与糖晶甜气的糖果公园，北岸依附着铁架交错的北岸桥头，东北高地则是俯瞰全城的月见台；中东部坐落着终年雾气缭绕的玻璃温室，顺着东南沿河而下是残破肃穆的旧教堂，再往东南荒郊延伸则是荒草丛生的南十字街区；河西则是版图最庞大、蛛网般巷弄密布的旧城区，其中西部耸立着指针常年卡顿的旧钟楼，西南沿河一带有大量废弃吊臂低垂的星见川码头。九大辖区各自承载着独特的地形偏折与法术环境，深切影响着每一场遭遇战的走势。', { keys: ['辖区', '地图', '区域', '糖果公园', '星见川', '旧城区', '码头', '教堂'], priority: 70, order: 8 }),
    entry('missions', '委托与时限', '事务所业务严格区分为调查与战斗两类：调查委托考验队员对因果脉络的洞察特长，通过现场排查判定胜负；战斗委托直面怪异畸变，需按回合展开硬碰硬攻防。紧急委托时限紧迫，长期委托赏金丰厚并允许跨夜推进。此外，带有少女私人印记的故事线委托享有最高保全等级，绝不参与打烊清理，唯有将其攻破方能揭开命运下一幕。', { constant: true, priority: 80, order: 9 }),
    entry('council', '议会', '当夜幕低垂，会客厅那张沉重长桌旁便会坐满来自月蚀庭、星灯协会与市役所的对外代表。他们代表各自势力的利害诉求，轮番呈递涉及经费划拨、人员借调以至辖区让渡的敏感提案，言辞之间多是看似温和的试探与筹码交换。所长笔下的决断关乎整座城市的平衡：签署批准将直接重塑街区版图与账务开销；断然驳回虽能守住底线，却不可避免地引发势力的嫌隙与敌意；而选择暂缓搁置，也仅仅是将无可逃避的风暴推移至下一次敲门声响起之时。', { keys: ['议会', '会客厅', '议题', '代表', '决议'], priority: 65, order: 10 }),
    entry('dorm', '宿舍', '宿舍是契约者在漫长值夜后唯一能够褪下戒备、安歇躯壳的避风港。随着床位设施与生活机能的修缮升级，每晚能够容纳更多的在编人员，且深度睡眠对精神疲惫的驱散效率亦会显著提升。当成员的疲劳数值突破80点警戒线时，神经的过度绷紧会导致魔力回路严重失控，必须被强制收编待命；若连续数夜高强度出勤而得不到喘息，身体将逐渐丧失自愈机能，使休整恢复的周期成倍拉长。', { keys: ['宿舍', '疲劳', '休息', '床位'], priority: 60, order: 11 }),
    entry('clinic', '诊所与治疗', '月光诊所专注于通过特殊配制的生物药液弥补躯体的崩解创口，其费用严格依据失血总量与肉体撕裂程度计价，并以小时为单位线性弥合伤势，但对日积月累的精神疲劳无能为力。处于药浴修复与缝合期内的成员身体软化，严禁签发任何派遣调度，亦不得参与高强度的会客厅议题辩论。创口越是深重入骨，所索取的星砂账单便越是高昂，等待肌肉纤维重新咬合的漫长耗时也愈发难熬。', { keys: ['诊所', '治疗', '受伤', '手术'], priority: 60, order: 12 }),
    entry('kink', '治疗癖好', '部分常年在生死边缘游走的契约者，唯有在被深度照料、触碰甚至施加某种特定约束时，绷紧至极点的心弦才会产生奇特的情感宣泄与放松。接纳此类带有特殊癖好的私人护理疗程，开销更为昂贵且耗时更长，然而当手术室的帘幕拉开时，双方的心理依存度将显著加深，伴随而来的则是法蚀杂质的同步上扬；若该成员早已沉溺于此种治愈偏好，再度推入疗程时，其羁绊交织与魔力异化的共振幅度将成倍放大。', { keys: ['癖好', '治疗癖好'], priority: 55, order: 13 }),
    entry('story', '故事线', '每位契约少女的命运齿轮在同一时期仅能维系一条专属的故事轨迹。长线手稿由数个高潮迭起的章节幕次串联而成，每一幕皆锚定着明确的现场追查指标；唯有攻克特定的故事委托，方能唤起该节点上的深度私人互动，并于余波平息之后解锁下一阶段的执念。少女的故事线享有崇高豁免，能够跨越漫漫长夜稳固封存，静静守候在档案深处等待下一次执意续写。', { keys: ['故事线', '剧情', '羁绊事件', '特殊事件'], priority: 70, order: 14 }),
    entry('battle-note', '战斗札记', '战斗结束后值班席有权将交锋日志展开为带体温的详实札记：以回合为脉络，真实复盘那一瞬间是谁挺身挡下致命穿刺、是谁心神动摇，又是谁的魔杖擦亮了生路。这份札记将沉淀为后续人际互动的记忆基石，笔墨必须严格忠实于战报事实，容不得半点虚构粉饰。', { keys: ['战斗', '札记', '战斗记录', '回合'], priority: 55, order: 15 }),
    entry('ending-leave', '离城结局', '【离城】攒够十万星砂，所长可把灯留在身后，体面离开樱雾市；不是逃亡或破产，是自己选定的收摊。这一局的故事收束为「离城」，事务所与契约者仍在。\n\n【写法】离城是主动的终局，不是死亡或失败。', { keys: ['离城', '离开樱雾市', '结局', '收摊'], priority: 60, order: 16 }),
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

/** 本地文件里的同一份世界书（v169）：换浏览器、清缓存之后还能拿回来。 */
export const WORLDBOOK_STORE_KEY = 'worldbook/entries';

/** 把世界书写进存档（本地文件优先，静态部署退回浏览器）。这就是「覆盖默认」的那一步。 */
export async function saveWorldbookToStore(entries: WorldbookEntry[]): Promise<boolean> {
  try {
    await kvSet(WORLDBOOK_STORE_KEY, entries.slice(0, 80));
    return true;
  } catch {
    return false;
  }
}

/** 读回存档里的世界书；没有或读坏了返回 undefined，让调用方继续用浏览器里的那份。 */
export async function loadWorldbookFromStore(): Promise<WorldbookEntry[] | undefined> {
  try {
    const raw = await kvGet<unknown>(WORLDBOOK_STORE_KEY);
    if (!Array.isArray(raw)) return undefined;
    const list = raw.map((item, index) => sanitizeWorldbookEntry(item, index)).filter((item): item is WorldbookEntry => Boolean(item));
    return list.length ? list : undefined;
  } catch {
    return undefined;
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

/**
 * 常驻词条是「游戏的说明书」：
 * 每次启动时不仅补齐缺失的常驻条目，若内置常驻条目有新版文本也会同步更新，
 * 避免老玩家浏览器 localStorage 里一直死锁着旧版文案；玩家自定义的词条绝不触动。
 */
export function syncBuiltinWorldbook(): boolean {
  let entries: WorldbookEntry[];
  try {
    const raw = localStorage.getItem(WORLDBOOK_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown[] }).entries) ? (parsed as { entries: unknown[] }).entries : null;
    if (!list) return false;
    entries = list.map((item, index) => sanitizeWorldbookEntry(item, index)).filter((item): item is WorldbookEntry => Boolean(item));
    if (!entries.length) return false;
  } catch {
    return false;
  }
  const builtins = new Map(builtinWorldbook().map(item => [item.id, item]));
  let changed = false;
  // v176：这里**只补缺失的常驻词条**，绝不覆盖已有内容。
  // 以前「内置常驻条目有新版文本就同步」会把玩家自己改过的词条改回默认，
  // 表现就是「改完世界书，重启又变回默认」。
  const updated = entries.map(item => {
    if (item.id === OFFICE_WORLDBOOK_ID) return item;
    const fresh = builtins.get(item.id);
    // 老档里的势力名迁移仍然要做（纯替换旧名，不动正文其余部分）。
    if (item.content.includes(LEGACY_FACTION_NAME)) {
      changed = true;
      return { ...item, content: item.content.split(LEGACY_FACTION_NAME).join(FACTION_NAME) };
    }
    return fresh ? item : item;
  });
  const exist = new Set(updated.map(item => item.id));
  // v206：离城结局不是常驻词条，但老档也要补上，否则新写的结局设定看不到。
  const missing = builtinWorldbook().filter(item => (item.constant || item.id === 'ending-leave') && !exist.has(item.id));
  if (missing.length) {
    updated.push(...missing);
    changed = true;
  }
  if (!changed) return false;
  updated.sort((a, b) => b.priority - a.priority || a.order - b.order);
  const ok = saveWorldbook(updated);
  if (ok && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(WORLDBOOK_EVENT));
    } catch {
      /* 隐私模式下 dispatch 可能抛错，写盘已成功就不影响使用 */
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
