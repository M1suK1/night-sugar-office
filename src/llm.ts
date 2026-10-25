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
  try {
    const response = await fetch(`${config.endpoint.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey.trim()}` },
    });
    if (!response.ok) return { ok: false, message: `连接失败：服务返回 ${response.status}。` };
    return { ok: true, message: '连接成功，模型服务可以访问。' };
  } catch {
    return { ok: false, message: '连接失败：浏览器无法访问该地址，或服务未允许跨域请求。' };
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
}

const elements = ['星光', '糖霜', '月影', '花息', '潮汐', '余烬', '魔物'] as const;
const archetypes = ['战斗', '调查', '支援', '防御', '治疗', '控制'] as const;
const ranks = ['碎屑', '游荡', '灾厄', '王座'] as const;

export async function generateDaily(config: LlmConfig, prompts: LlmPrompts): Promise<{ ok: true; data: GeneratedDaily } | { ok: false; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  const schema = `只输出一个 JSON 对象，不要 Markdown 代码块。字段：
{"monsterName":"","monsterEpithet":"","monsterRank":"碎屑|游荡|灾厄|王座","monsterElement":"星光|糖霜|月影|花息|潮汐|余烬|魔物","monsterTrait":"","monsterDescription":"","monsterHabit":"","monsterWeakness":"",
"girlName":"","girlCodename":"","girlTitle":"","girlElement":"星光|糖霜|月影|花息|潮汐|余烬|魔物","girlArchetype":"战斗|调查|支援|防御|治疗|控制","girlQuote":"","girlGoal":"","girlSkill":"","girlAppearance":"","girlPersonality":"","girlOutfit":"",
"missionTitle":"","missionCategory":"","missionDescription":""}`;
  try {
    const response = await fetch(`${config.endpoint.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.85,
        messages: [
          { role: 'system', content: `${prompts.world}\n\n${prompts.daily}\n\n${schema}` },
          { role: 'user', content: '请提交今晚的提案。' },
        ],
      }),
    });
    if (!response.ok) return { ok: false, message: `生成失败：服务返回 ${response.status}。` };
    const body = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, message: '模型没有返回可解析的 JSON。' };
    const raw = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (key: string, fallback: string) => typeof raw[key] === 'string' && (raw[key] as string).trim() ? (raw[key] as string).trim().slice(0, 160) : fallback;
    const rank = ranks.includes(raw.monsterRank as typeof ranks[number]) ? raw.monsterRank as typeof ranks[number] : '游荡';
    const element = elements.includes(raw.monsterElement as typeof elements[number]) ? raw.monsterElement as typeof elements[number] : '月影';
    const girlElement = elements.includes(raw.girlElement as typeof elements[number]) ? raw.girlElement as typeof elements[number] : '星光';
    const archetype = archetypes.includes(raw.girlArchetype as typeof archetypes[number]) ? raw.girlArchetype as typeof archetypes[number] : '支援';
    const data: GeneratedDaily = {
      monsterName: str('monsterName', '无名之影'), monsterEpithet: str('monsterEpithet', '从夜里长出来的东西'), monsterRank: rank,
      monsterElement: element, monsterTrait: str('monsterTrait', '它似乎害怕被叫出名字。'), monsterDescription: str('monsterDescription', '一团没有影子的轮廓。'),
      monsterHabit: str('monsterHabit', '总在路灯熄灭后出现。'), monsterWeakness: str('monsterWeakness', '被认真注视时会退后。'),
      girlName: str('girlName', '未命名'), girlCodename: str('girlCodename', '新来的契约者'), girlTitle: str('girlTitle', '还没有被城市记住'),
      girlElement, girlArchetype: archetype, girlQuote: str('girlQuote', '我会努力不添麻烦的。'), girlGoal: str('girlGoal', '想找到一个可以回去的地方。'),
      girlSkill: str('girlSkill', '未命名魔法'), girlAppearance: str('girlAppearance', '短发，发梢有一缕不合规矩的挑染。'),
      girlPersonality: str('girlPersonality', '安静，习惯先观察再开口。'), girlOutfit: str('girlOutfit', '事务所配发的值夜制服，袖口略长。'),
      missionTitle: str('missionTitle', '没有名字的委托'), missionCategory: str('missionCategory', '异象调查'), missionDescription: str('missionDescription', '地图边缘出现了一处无法解释的空缺。'),
    };
    return { ok: true, data };
  } catch {
    return { ok: false, message: '生成失败：浏览器无法访问接口，或返回内容不是合法 JSON。' };
  }
}

import { createSeedPack } from './content/seed-pack.ts';
import { monsters as baseMonsters } from './content/monsters.ts';
import type { GameState, Girl, Mission, MonsterTemplate } from './types';

export function materializeDaily(data: GeneratedDaily, state: GameState): { monster: MonsterTemplate; girl: Girl; mission: Mission } {
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
  return { monster, girl, mission };
}
