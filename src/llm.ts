export interface LlmConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

const KEY = 'night-sugar:llm-config';

export const defaultLlmConfig: LlmConfig = {
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultLlmConfig };
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    return {
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : defaultLlmConfig.endpoint,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : defaultLlmConfig.model,
    };
  } catch {
    return { ...defaultLlmConfig };
  }
}

export function saveLlmConfig(config: LlmConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // Storage can be unavailable in private windows; the form still works for this session.
  }
}

export async function testLlmConnection(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先填写 API 密钥。' };
  if (!/^https?:\/\//.test(config.endpoint)) return { ok: false, message: '接口地址必须以 http:// 或 https:// 开头。' };
  const model = config.model.trim();
  if (!model) return { ok: false, message: '请先填写模型名称。' };
  try {
    const response = await fetch(`${apiBase(config.endpoint)}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey.trim()}` },
    });
    if (!response.ok) {
      const detail = await errorDetail(response);
      return { ok: false, message: `连接失败：服务返回 ${response.status}${detail ? `（${detail}）` : ''}。` };
    }
    const body = await response.json().catch(() => null) as { data?: { id?: string }[] } | null;
    const ids = body?.data?.map(item => item.id).filter(Boolean) ?? [];
    if (ids.length && !ids.includes(model)) {
      return { ok: false, message: `服务可以访问，但模型列表里没有「${model}」。请从设置中改成可用模型，例如 ${ids.slice(0, 3).join('、')}。` };
    }
    return { ok: true, message: ids.length ? `连接成功，模型「${model}」可用。` : '连接成功，模型服务可以访问。' };
  } catch {
    return { ok: false, message: '连接失败：浏览器无法访问该地址，或服务未允许跨域请求。' };
  }
}

function apiBase(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
}

async function errorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const message = typeof body.error === 'string' ? body.error : body.error?.message ?? body.message;
    if (message) return String(message).slice(0, 220);
  } catch { /* fall through to raw text */ }
  return text.replace(/\s+/g, ' ').slice(0, 220);
}

async function chat(config: LlmConfig, messages: { role: 'system' | 'user'; content: string }[]): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  if (!/^https?:\/\//.test(config.endpoint)) return { ok: false, message: '接口地址必须以 http:// 或 https:// 开头。' };
  const model = config.model.trim();
  if (!model) return { ok: false, message: '请先在设置中填写模型名称。' };
  try {
    const url = `${apiBase(config.endpoint)}/chat/completions`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` };
    const payload: Record<string, unknown> = { model, messages };
    // Reasoning models such as o1/o3/gpt-5 reject temperature with HTTP 400.
    if (!/^(o1|o3|o4|gpt-5)/i.test(model)) payload.temperature = 0.9;
    let response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!response.ok) {
      let detail = await errorDetail(response);
      // Some OpenAI-compatible gateways still reject temperature on models we cannot detect by name.
      if (response.status === 400 && /temperature/i.test(detail) && 'temperature' in payload) {
        const { temperature: _temperature, ...rest } = payload;
        response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(rest) });
        if (!response.ok) detail = await errorDetail(response);
      }
      if (!response.ok) return { ok: false, message: `服务返回 ${response.status}${detail ? `：${detail}` : ''}` };
    }
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) return { ok: false, message: '模型没有返回内容。' };
    return { ok: true, text };
  } catch {
    return { ok: false, message: '浏览器无法访问接口，或服务未允许跨域请求。' };
  }
}

export interface LlmPrompts {
  world: string;
  daily: string;
}

export const defaultPrompts: LlmPrompts = {
  world: '你是《夜糖事务所》的夜班叙事者。故事发生在永远停在深夜的樱雾市：魔法少女以契约换取力量，代价是灵魂慢慢被侵蚀。语气温柔、克制、带一点危险的甜味。不要写露骨内容，不要替玩家做决定。',
  daily: '为今晚提交一份提案：一只新的魔物、一位刚到市场的候选魔法少女、一条战斗委托。只描述名字、气质、愿望与外观，不要给任何数值、奖励或规则。',
};

export function loadLlmPrompts(): LlmPrompts {
  try {
    const raw = localStorage.getItem('night-sugar:llm-prompts');
    if (!raw) return { ...defaultPrompts };
    const parsed = JSON.parse(raw) as Partial<LlmPrompts>;
    return { world: typeof parsed.world === 'string' ? parsed.world : defaultPrompts.world, daily: typeof parsed.daily === 'string' ? parsed.daily : defaultPrompts.daily };
  } catch {
    return { ...defaultPrompts };
  }
}

export function saveLlmPrompts(prompts: LlmPrompts) {
  try { localStorage.setItem('night-sugar:llm-prompts', JSON.stringify(prompts)); } catch { /* session only */ }
}

export interface GeneratedDaily {
  monsterName: string; monsterEpithet: string; monsterRank: '碎屑' | '游荡' | '灾厄' | '王座';
  monsterElement: string; monsterTrait: string; monsterDescription: string; monsterHabit: string; monsterWeakness: string;
  girlName: string; girlCodename: string; girlTitle: string; girlElement: string; girlArchetype: string;
  girlQuote: string; girlGoal: string; girlSkill: string; girlAppearance: string; girlPersonality: string; girlOutfit: string;
  missionTitle: string; missionCategory: string; missionDescription: string;
  agendaTitle?: string; agendaText?: string; agendaRequest?: string; agendaTopic?: Opinion['topic'];
  envoyFaction?: 'witch' | 'association' | 'government'; envoyTitle?: string; envoyDescription?: string;
}

const elements = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物'] as const;
const archetypes = ['输出', '守护', '治愈', '控制', '侦查'] as const;
const ranks = ['碎屑', '游荡', '灾厄', '王座'] as const;
const agendaTopics = ['经费', '排班', '设施', '同伴', '城市', '私人心愿'] as const;
const factions = ['witch', 'association', 'government'] as const;

export async function generateDaily(config: LlmConfig, prompts: LlmPrompts): Promise<{ ok: true; data: GeneratedDaily } | { ok: false; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  const schema = `只输出一个 JSON 对象，不要 Markdown 代码块。字段：
{"monsterName":"","monsterEpithet":"","monsterRank":"碎屑|游荡|灾厄|王座","monsterElement":"星光系|糖霜系|月影系|梦境系|自然系|赤焰系","monsterTrait":"","monsterDescription":"","monsterHabit":"","monsterWeakness":"",
"girlName":"","girlCodename":"","girlTitle":"","girlElement":"星光系|糖霜系|月影系|梦境系|自然系|赤焰系","girlArchetype":"输出|守护|治愈|控制|侦查","girlQuote":"","girlGoal":"","girlSkill":"","girlAppearance":"","girlPersonality":"","girlOutfit":"",
"missionTitle":"","missionCategory":"","missionDescription":"",
"agendaTitle":"","agendaText":"","agendaRequest":"","agendaTopic":"经费|排班|设施|同伴|城市|私人心愿",
"envoyFaction":"witch|association|government","envoyTitle":"","envoyDescription":""}`;
  const result = await chat(config, [
    { role: 'system', content: `${prompts.world}\n\n${prompts.daily}\n\n${schema}` },
    { role: 'user', content: '请提交今晚的提案。' },
  ]);
  if (!result.ok) return { ok: false, message: `生成失败：${result.message}` };
  try {
    const text = result.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, message: '模型没有返回可解析的 JSON。' };
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (key: string, fallback: string) => typeof raw[key] === 'string' && (raw[key] as string).trim() ? (raw[key] as string).trim().slice(0, 160) : fallback;
    const rank = ranks.includes(raw.monsterRank as typeof ranks[number]) ? raw.monsterRank as typeof ranks[number] : '游荡';
    const element = elements.includes(raw.monsterElement as typeof elements[number]) ? raw.monsterElement as typeof elements[number] : '月影系';
    const girlElement = elements.includes(raw.girlElement as typeof elements[number]) ? raw.girlElement as typeof elements[number] : '星光系';
    const archetype = archetypes.includes(raw.girlArchetype as typeof archetypes[number]) ? raw.girlArchetype as typeof archetypes[number] : '治愈';
    const data: GeneratedDaily = {
      monsterName: str('monsterName', '无名之影'), monsterEpithet: str('monsterEpithet', '从夜里长出来的东西'), monsterRank: rank,
      monsterElement: element, monsterTrait: str('monsterTrait', '它似乎害怕被叫出名字。'), monsterDescription: str('monsterDescription', '一团没有影子的轮廓。'),
      monsterHabit: str('monsterHabit', '总在路灯熄灭后出现。'), monsterWeakness: str('monsterWeakness', '被认真注视时会退后。'),
      girlName: str('girlName', '未命名'), girlCodename: str('girlCodename', '新来的契约者'), girlTitle: str('girlTitle', '还没有被城市记住'),
      girlElement, girlArchetype: archetype, girlQuote: str('girlQuote', '我会努力不添麻烦的。'), girlGoal: str('girlGoal', '想找到一个可以回去的地方。'),
      girlSkill: str('girlSkill', '未命名魔法'), girlAppearance: str('girlAppearance', '短发，发梢有一缕不合规矩的挑染。'),
      girlPersonality: str('girlPersonality', '安静，习惯先观察再开口。'), girlOutfit: str('girlOutfit', '事务所配发的值夜制服，袖口略长。'),
      missionTitle: str('missionTitle', '没有名字的委托'), missionCategory: str('missionCategory', '异象调查'), missionDescription: str('missionDescription', '地图边缘出现了一处无法解释的空缺。'),
      agendaTitle: str('agendaTitle', '今晚的排班需要再确认'), agendaText: str('agendaText', '她在便签上写下了几个名字，又划掉了其中一个。'), agendaRequest: str('agendaRequest', '申请调整一次夜班顺序。'),
      agendaTopic: agendaTopics.includes(raw.agendaTopic as typeof agendaTopics[number]) ? raw.agendaTopic as Opinion['topic'] : '排班',
      envoyFaction: factions.includes(raw.envoyFaction as typeof factions[number]) ? raw.envoyFaction as 'witch' | 'association' | 'government' : 'association',
      envoyTitle: str('envoyTitle', '代表的口头委托'), envoyDescription: str('envoyDescription', '她没有留下书面任务书，只说今晚需要有人去一趟。'),
    };
    return { ok: true, data };
  } catch {
    return { ok: false, message: '生成失败：浏览器无法访问接口，或返回内容不是合法 JSON。' };
  }
}

export interface GeneratedGirlProfile {
  name: string; codename: string; title: string; element: Element; archetype: Archetype;
  quote: string; goal: string; appearance: string; personality: string; outfitDescription: string;
  focus: StatKey; skillIds: string[]; traitIds: string[];
}

export async function generateGirlProfile(config: LlmConfig, prompts: LlmPrompts): Promise<{ ok: true; data: GeneratedGirlProfile } | { ok: false; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  const skillList = skills.filter(s => s.school !== 'monster').map(s => `${s.id}(${s.name})`).join('、');
  const traitList = traits.map(t => `${t.id}(${t.name})`).join('、');
  const schema = `只输出一个 JSON 对象，不要 Markdown 代码块。字段：
{"name":"","codename":"","title":"","element":"星光系|糖霜系|月影系|梦境系|自然系|赤焰系","archetype":"输出|守护|治愈|控制|侦查","quote":"","goal":"","appearance":"","personality":"","outfitDescription":"","focus":"magic|insight|agility|empathy","skillIds":["","",""],"traitIds":["","",""]}
skillIds 只能从以下 ID 中选三个：${skillList}
traitIds 只能从以下 ID 中选三个：${traitList}`;
  const result = await chat(config, [
    { role: 'system', content: `${prompts.world}\n\n为玩家正在登记的新魔法少女起草一份档案。只写气质与文案，不要给数值。\n\n${schema}` },
    { role: 'user', content: '请起草这位新契约者。' },
  ]);
  if (!result.ok) return { ok: false, message: `起草失败：${result.message}` };
  try {
    const text = result.text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, message: '模型没有返回可解析的 JSON。' };
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (key: string, fallback: string) => typeof raw[key] === 'string' && (raw[key] as string).trim() ? (raw[key] as string).trim().slice(0, 160) : fallback;
    const knownSkills = skills.filter(s => s.school !== 'monster');
    const pickedSkills = Array.isArray(raw.skillIds) ? raw.skillIds.filter((id): id is string => typeof id === 'string' && knownSkills.some(s => s.id === id)) : [];
    const skillIds = [...new Set(pickedSkills)].slice(0, 3);
    for (const skill of knownSkills) { if (skillIds.length >= 3) break; if (!skillIds.includes(skill.id)) skillIds.push(skill.id); }
    const pickedTraits = Array.isArray(raw.traitIds) ? raw.traitIds.filter((id): id is string => typeof id === 'string' && traits.some(t => t.id === id)) : [];
    const traitIds = [...new Set(pickedTraits)].slice(0, 3);
    for (const trait of traits) { if (traitIds.length >= 3) break; if (!traitIds.includes(trait.id)) traitIds.push(trait.id); }
    const element = elements.includes(raw.element as typeof elements[number]) ? raw.element as Element : '星光系';
    const archetype = archetypes.includes(raw.archetype as typeof archetypes[number]) ? raw.archetype as Archetype : '治愈';
    const focus: StatKey = ['magic', 'insight', 'agility', 'empathy'].includes(raw.focus as string) ? raw.focus as StatKey : 'magic';
    return { ok: true, data: {
      name: str('name', '未命名'), codename: str('codename', '未命名契约'), title: str('title', '刚被城市记住的人'),
      element: element === ('魔物' as Element) ? '星光系' : element, archetype: archetype === ('魔物' as Archetype) ? '治愈' : archetype,
      quote: str('quote', '请多指教。'), goal: str('goal', '想找到一个可以回去的地方。'),
      appearance: str('appearance', '短发，发梢有一缕不合规矩的挑染。'), personality: str('personality', '安静，习惯先观察再开口。'),
      outfitDescription: str('outfitDescription', '事务所配发的值夜制服，袖口略长。'), focus, skillIds, traitIds,
    } };
  } catch {
    return { ok: false, message: '起草失败：浏览器无法访问接口，或返回内容不是合法 JSON。' };
  }
}

import { createSeedPack } from './content/seed-pack.ts';
import { monsters as baseMonsters } from './content/monsters.ts';
import { skills } from './content/skills.ts';
import { traits } from './content/traits.ts';
import type { Archetype, Element, GameState, Girl, Mission, MonsterTemplate, Opinion, StatKey } from './types';

export function materializeDaily(data: GeneratedDaily, state: GameState): { monster: MonsterTemplate; girl: Girl; mission: Mission; opinion: Opinion; envoyMission: Mission } {
  const pack = createSeedPack();
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 999).toString(36)}`;
  const baseMonster = baseMonsters.find(m => m.rank === data.monsterRank) ?? baseMonsters[1];
  const monster: MonsterTemplate = {
    ...baseMonster,
    id: `lm_${stamp}`,
    name: data.monsterName,
    epithet: data.monsterEpithet,
    element: data.monsterElement as MonsterTemplate['element'],
    trait: data.monsterTrait,
    description: data.monsterDescription,
    codex: { habit: data.monsterHabit, weakness: data.monsterWeakness },
    spec: { ...baseMonster.spec },
  };
  const baseGirl = pack.girls[1];
  const girl: Girl = {
    ...baseGirl,
    id: `g_${stamp}`,
    name: data.girlName,
    codename: data.girlCodename,
    title: data.girlTitle,
    element: data.girlElement as Girl['element'],
    archetype: data.girlArchetype as Girl['archetype'],
    color: '#f3aec9',
    portrait: '',
    level: 1,
    stats: { magic: 62, insight: 62, agility: 62, empathy: 62 },
    baseStats: { magic: 62, insight: 62, agility: 62, empathy: 62 },
    hp: 100, maxHp: 100, baseMaxHp: 100, spirit: 80, maxSpirit: 80,
    status: 'idle', roomId: 'lounge', remaining: 0, missionId: undefined,
    skill: data.girlSkill,
    goal: data.girlGoal,
    goalKind: '生活',
    appearance: data.girlAppearance,
    personality: data.girlPersonality,
    outfitDescription: data.girlOutfit,
    quote: data.girlQuote,
    corruption: 0, witch: false, drugUntilDay: undefined, withdrawalDays: 0,
    contractEndDay: state.day + 20, contractDays: 20, contractRenewals: 0, pensionMissed: 0,
    relationships: { player: 20 },
    scars: [], conditions: [], retired: false, dead: false,
  };
  const baseMission = pack.missions.find(m => m.work === 'combat') ?? pack.missions[0];
  const mission: Mission = {
    ...baseMission,
    id: `m_${stamp}`,
    title: data.missionTitle,
    category: data.missionCategory,
    description: data.missionDescription,
    x: 18 + Math.floor(Math.random() * 62),
    y: 24 + Math.floor(Math.random() * 52),
    difficulty: '中危',
    duration: 60,
    reward: 900,
    requirement: 'insight',
    target: 58,
    color: '#f3aec9',
    status: 'open',
    squad: [],
    enemyIds: [monster.id],
    rounds: 4,
    attempts: 0,
    worsened: false,
    lastOutcome: undefined,
    recommendedLevel: 2,
    faction: undefined,
    envoy: false,
    boss: false,
    generated: true,
    sourcePack: 'llm',
  };
  const author = [...state.girls].filter(g => !g.retired && !g.dead).sort((a, b) => b.bond - a.bond)[0] ?? state.girls[0];
  const opinion: Opinion = {
    id: `op_${stamp}`, day: state.day, authorId: author?.id ?? state.girls[0].id, topic: data.agendaTopic ?? '排班',
    title: data.agendaTitle ?? '今晚的排班需要再确认', text: data.agendaText ?? '她在便签上写下了几个名字，又划掉了其中一个。',
    request: data.agendaRequest ?? '申请调整一次夜班顺序。', status: 'pending',
    options: [
      { id: 'accept', label: '批准', effect: '消耗资源，提出者羁绊提升' },
      { id: 'defer', label: '暂缓', effect: '不消耗资源，留待下个议事日' },
      { id: 'reject', label: '驳回', effect: '节省资源，提出者羁绊下降' },
    ],
    assistantNote: '这份议题由故事引擎起草，数值与后果仍由本地规则决定。',
  };
  const envoyMission: Mission = {
    ...mission, id: `m_env_${stamp}`, title: data.envoyTitle ?? '代表的口头委托', category: '代表委托',
    description: data.envoyDescription ?? '她没有留下书面任务书，只说今晚需要有人去一趟。',
    faction: data.envoyFaction ?? 'association', envoy: true, duration: 45, reward: 720,
    requirement: 'empathy', target: 52, rounds: 3, enemyIds: [monster.id],
    x: (mission.x + 31) % 78 + 8, y: (mission.y + 19) % 58 + 12,
  };
  return { monster, girl, mission, opinion, envoyMission };
}
