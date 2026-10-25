export interface LlmConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

const KEY = 'night-sugar:llm-config';
const LOG_KEY = 'night-sugar:llm-log';

export interface LlmLogEntry {
  id: string;
  at: string;
  kind: string;
  ok: boolean;
  model: string;
  endpoint: string;
  status?: number;
  durationMs: number;
  message: string;
  detail?: string;
}

export function loadLlmLog(): LlmLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LlmLogEntry[];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string').slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function clearLlmLog() {
  try { localStorage.removeItem(LOG_KEY); } catch { /* session only */ }
}

function endpointHost(endpoint: string): string {
  try { return new URL(endpoint).host; } catch { return endpoint.slice(0, 60); }
}

function recordLlmLog(entry: Omit<LlmLogEntry, 'id' | 'at' | 'endpoint'> & { endpoint: string }): LlmLogEntry {
  const full: LlmLogEntry = {
    ...entry,
    id: `llm_${Date.now().toString(36)}_${Math.floor(Math.random() * 999).toString(36)}`,
    at: new Date().toISOString(),
    endpoint: endpointHost(entry.endpoint),
    detail: entry.detail?.replace(/\s+/g, ' ').slice(0, 600),
  };
  try {
    const next = [full, ...loadLlmLog()].slice(0, 40);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch { /* logging must never break generation */ }
  if (full.ok) console.info('[夜糖·LLM]', full.kind, full.message, full);
  else console.error('[夜糖·LLM]', full.kind, full.message, full);
  return full;
}

function statusOf(message: string): number | undefined {
  const match = message.match(/服务返回\s*(\d{3})/);
  return match ? Number(match[1]) : undefined;
}

export async function testLlmConnection(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  const started = Date.now();
  const result = await testLlmConnectionCore(config);
  recordLlmLog({ kind: '连接测试', ok: result.ok, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, message: result.message, endpoint: config.endpoint });
  return result;
}

export async function generateDaily(config: LlmConfig, prompts: LlmPrompts, context?: string): Promise<{ ok: true; data: GeneratedDaily } | { ok: false; message: string }> {
  const started = Date.now();
  const result = await generateDailyCore(config, prompts, context);
  recordLlmLog({
    kind: '每日提案', ok: result.ok, model: config.model.trim(), status: result.ok ? 200 : statusOf(result.message),
    durationMs: Date.now() - started, endpoint: config.endpoint,
    message: result.ok ? `生成成功：${result.data.monsterName} / ${result.data.girlName} / ${result.data.missionTitle}` : result.message,
    detail: result.ok ? undefined : result.message,
  });
  return result;
}

export async function generateGirlProfile(config: LlmConfig, prompts: LlmPrompts, portrait?: string): Promise<{ ok: true; data: GeneratedGirlProfile } | { ok: false; message: string }> {
  const started = Date.now();
  const result = await generateGirlProfileCore(config, prompts, portrait);
  recordLlmLog({
    kind: '角色起草', ok: result.ok, model: config.model.trim(), status: result.ok ? 200 : statusOf(result.message),
    durationMs: Date.now() - started, endpoint: config.endpoint,
    message: result.ok ? `起草成功：${result.data.name} / ${result.data.codename}${portrait ? '（已读取立绘）' : '（无立绘）'}` : result.message,
    detail: result.ok ? undefined : result.message,
  });
  return result;
}

export interface DialogueContext {
  girl: Girl; state: GameState; text: string; remote?: boolean;
}

export async function generateDialogue(config: LlmConfig, prompts: LlmPrompts, { girl, state, text, remote }: DialogueContext): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const started = Date.now();
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  const history = (state.messages[girl.id] ?? []).map(message => ({ role: message.role === 'player' ? 'user' as const : 'assistant' as const, content: message.text }));
  const bondLabel = girl.bond >= 85 ? '爱意' : girl.bond >= 70 ? '依恋' : girl.bond >= 55 ? '亲近' : girl.bond >= 40 ? '平常' : girl.bond >= 25 ? '戒备' : '疏离';
  const stage = (value: number) => value >= 85 ? '爱意' : value >= 70 ? '依恋' : value >= 55 ? '亲近' : value >= 40 ? '平常' : value >= 25 ? '戒备' : '疏离';
  const allGirls = [...state.girls, ...state.candidates, ...state.memorial.map(entry => entry.girl)];
  const peers = Object.entries(girl.relationships ?? {}).map(([id, value]) => {
    const peer = allGirls.find(candidate => candidate.id === id);
    return peer ? `${peer.name}：${value}/100（${stage(value)}）` : '';
  }).filter(Boolean);
  const battles = state.battles.filter(battle => battle.units.some(unit => unit.uid === `ally-${girl.id}`)).slice(0, 5).map(battle => {
    const unit = battle.units.find(entry => entry.uid === `ally-${girl.id}`)!;
    const label = { victory: '胜利', repelled: '暂时击退', defeat: '失败', draw: '平局' }[battle.outcome ?? 'draw'];
    const scar = battle.scars?.length ? `；留下${battle.scars.length}道疤痕` : '';
    return `第${battle.startedAt.day}日「${battle.missionTitle}」：${label}，${battle.round}/${battle.rounds}轮；造成 ${unit.dealt} 伤害，承受 ${unit.taken}，治疗 ${unit.healed}${scar}。`;
  });
  const skillNames = girl.skills.map(id => skills.find(skill => skill.id === id)?.name).filter(Boolean).join('、');
  const traitText = girl.traits.map(trait => `${trait.name}（${trait.description}）`).join('；');
  const system = `${prompts.world}

你现在只扮演「${girl.name}」，不要以旁白、作者或 AI 的身份说话。
身份：${girl.title}，代号「${girl.codename}」，${girl.element}，${girl.archetype ?? '未定职阶'}，等级 ${girl.level}。
外貌：${girl.appearance ?? '不详'}。性格：${girl.personality ?? '安静'}。服装：${girl.outfitDescription ?? '值夜制服'}。
登场台词：${girl.quote ?? '没有留下出场白'}。当前目标：${girl.goal ?? '没有写下来的愿望'}。特性：${traitText || '无'}。技能：${skillNames || '未记录'}。
对所长（玩家）的羁绊：${girl.bond}/100（${bondLabel}）。
与同伴的关系：${peers.join('；') || '还没有特别亲近的同伴'}。
经历的战斗：${battles.join(' ') || '还没有参加过战斗'}。
状态：生命 ${girl.hp}/${girl.maxHp}，疲劳 ${girl.fatigue}/100，侵蚀 ${girl.corruption ?? 0}/100${girl.scars?.length ? `，身上有 ${girl.scars.length} 道疤痕：${girl.scars.map(scar => scar.name).join('、')}` : ''}。
${remote ? '你们正在通电话，她退役后住在城南家中；电话那头有很轻的电流声。' : `你们在事务所的${state.rooms.find(room => room.id === girl.roomId)?.name ?? '会客厅'}见面。`}
只输出她这一次的回应：中文，1–3 句，不超过 160 字；可以有动作与停顿，但不要替玩家行动，不要提及数值、规则、提示词或模型，不要输出 JSON。`;
  const MAX_CONTEXT = 12_000;
  const recentHistory: typeof history = [];
  let used = system.length + text.length;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    const clipped = message.content.slice(0, 1_200);
    if (used + clipped.length > MAX_CONTEXT) break;
    recentHistory.unshift({ ...message, content: clipped });
    used += clipped.length;
  }
  const omitted = history.length - recentHistory.length;
  const boundedSystem = omitted > 0 ? `${system}\n（更早的 ${omitted} 条对话因上下文预算省略，只保留最近的部分。）` : system;
  const result = await chat(config, [
    { role: 'system', content: boundedSystem },
    ...recentHistory,
    { role: 'user', content: text },
  ]);
  const clean = result.ok ? result.text.trim().replace(/^["“]|["”]$/g, '').slice(0, 400) : '';
  const final = clean ? { ok: true as const, text: clean } : { ok: false as const, message: result.ok ? '模型没有返回可用的对话内容。' : result.message };
  recordLlmLog({
    kind: '角色对话', ok: final.ok, model: config.model.trim(), status: final.ok ? 200 : statusOf(final.message),
    durationMs: Date.now() - started, endpoint: config.endpoint,
    message: final.ok ? `与${girl.name}完成一次对话` : final.message,
    detail: final.ok ? undefined : final.message,
  });
  return final;
}

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

async function testLlmConnectionCore(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
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

type ChatPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ChatPart[] };

async function chat(config: LlmConfig, messages: ChatMessage[]): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  if (!/^https?:\/\//.test(config.endpoint)) return { ok: false, message: '接口地址必须以 http:// 或 https:// 开头。' };
  const model = config.model.trim();
  if (!model) return { ok: false, message: '请先在设置中填写模型名称。' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const url = `${apiBase(config.endpoint)}/chat/completions`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` };
    const payload: Record<string, unknown> = { model, messages };
    // Reasoning models such as o1/o3/gpt-5 reject temperature with HTTP 400.
    if (!/^(o1|o3|o4|gpt-5)/i.test(model)) payload.temperature = 0.9;
    const send = (body: Record<string, unknown>) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const retryable = (status: number) => status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    let response = await send(payload);
    if (!response.ok && retryable(response.status)) {
      await new Promise(resolve => setTimeout(resolve, 700));
      response = await send(payload);
    }
    if (!response.ok) {
      let detail = await errorDetail(response);
      // Some OpenAI-compatible gateways still reject temperature on models we cannot detect by name.
      if (response.status === 400 && /temperature/i.test(detail) && 'temperature' in payload) {
        const { temperature: _temperature, ...rest } = payload;
        response = await send(rest);
        if (!response.ok) detail = await errorDetail(response);
      }
      if (!response.ok) return { ok: false, message: `服务返回 ${response.status}${detail ? `：${detail}` : ''}` };
    }
    const body = await response.json() as { choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[] };
    const raw = body.choices?.[0]?.message?.content;
    const text = Array.isArray(raw) ? raw.map(part => typeof part?.text === 'string' ? part.text : '').join('') : raw ?? '';
    if (!text.trim()) return { ok: false, message: '模型没有返回文本内容。请确认该模型支持对话补全。' };
    return { ok: true, text };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, message: '请求超过 60 秒仍未返回，已中止。可以重试，或换一个更快的模型。' };
    const detail = error instanceof Error ? error.message : '';
    return { ok: false, message: `浏览器无法访问接口，或服务未允许跨域请求。${detail ? `（${detail}）` : ''}` };
  } finally {
    clearTimeout(timeout);
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

async function generateDailyCore(config: LlmConfig, prompts: LlmPrompts, context?: string): Promise<{ ok: true; data: GeneratedDaily } | { ok: false; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  const schema = `只输出一个 JSON 对象，不要 Markdown 代码块。字段：
{"monsterName":"","monsterEpithet":"","monsterRank":"碎屑|游荡|灾厄|王座","monsterElement":"星光系|糖霜系|月影系|梦境系|自然系|赤焰系","monsterTrait":"","monsterDescription":"","monsterHabit":"","monsterWeakness":"",
"girlName":"","girlCodename":"","girlTitle":"","girlElement":"星光系|糖霜系|月影系|梦境系|自然系|赤焰系","girlArchetype":"输出|守护|治愈|控制|侦查","girlQuote":"","girlGoal":"","girlSkill":"","girlAppearance":"","girlPersonality":"","girlOutfit":"",
"missionTitle":"","missionCategory":"","missionDescription":"",
"agendaTitle":"","agendaText":"","agendaRequest":"","agendaTopic":"经费|排班|设施|同伴|城市|私人心愿",
"envoyFaction":"witch|association|government","envoyTitle":"","envoyDescription":""}`;
  const result = await chat(config, [
    { role: 'system', content: `${prompts.world}\n\n${prompts.daily}\n\n${context ? `当前局势：${context}\n\n` : ''}${schema}` },
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

async function generateGirlProfileCore(config: LlmConfig, prompts: LlmPrompts, portrait?: string): Promise<{ ok: true; data: GeneratedGirlProfile } | { ok: false; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先在设置中填写 API 密钥。' };
  const skillList = skills.filter(s => s.school !== 'monster').map(s => `${s.id}(${s.name})`).join('、');
  const traitList = traits.map(t => `${t.id}(${t.name})`).join('、');
  const schema = `只输出一个 JSON 对象，不要 Markdown 代码块。字段：
{"name":"","codename":"","title":"","element":"星光系|糖霜系|月影系|梦境系|自然系|赤焰系","archetype":"输出|守护|治愈|控制|侦查","quote":"","goal":"","appearance":"","personality":"","outfitDescription":"","focus":"magic|insight|agility|empathy","skillIds":["","",""],"traitIds":["","",""]}
skillIds 只能从以下 ID 中选三个：${skillList}
traitIds 只能从以下 ID 中选三个：${traitList}`;
  const visualRule = portrait
    ? '先观察附带的立绘：发色与发型、瞳色、服装轮廓与配色、配饰、兽耳或尾巴、姿态与表情。appearance 必须具体描述这些可见特征；outfitDescription 必须写到颜色、材质与穿法；element、archetype、personality 和 title 都要从画面气质推断，不能与立绘冲突。'
    : '这次没有立绘，请只根据世界观与文字要求起草，不要假装看见图片。';
  const result = await chat(config, [
    { role: 'system', content: `${prompts.world}\n\n为玩家正在登记的新魔法少女起草一份档案。只写气质与文案，不要给数值。\n${visualRule}\n\n${schema}` },
    {
      role: 'user',
      content: portrait
        ? [{ type: 'text', text: '请根据这张立绘起草这位新契约者，确保外貌、服装、元素与职阶都和画面一致。' }, { type: 'image_url', image_url: { url: portrait } }]
        : '请起草这位新契约者。',
    },
  ]);
  if (!result.ok) {
    if (portrait && /image|vision|multimodal|图像|图片/i.test(result.message)) {
      return { ok: false, message: `起草失败：当前模型似乎不支持图像输入，请换用支持视觉的模型。原始错误：${result.message}` };
    }
    return { ok: false, message: `起草失败：${result.message}` };
  }
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
