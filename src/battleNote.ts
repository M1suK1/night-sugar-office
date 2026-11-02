import type { BattleNote, BattleNoteLine, BattleNoteScene, BattleState, Expression, MonsterTemplate, PortraitSpec } from './types';
import { pollutionTierLabel } from './pollution.ts';
import { findSkill } from './content/skills.ts';

export const BATTLE_NOTE_EXPRESSIONS: Expression[] = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'];
const EXPRESSION_SET = new Set<string>(BATTLE_NOTE_EXPRESSIONS);
const MIN_NOTE_CHARS = 900;
const MAX_NOTE_CHARS = 2200;
/** 新版连贯札记：一次写完，至少 6000 字。 */
const MIN_CONTINUOUS_CHARS = 6000;
const MAX_CONTINUOUS_CHARS = 12000;

export type BattleOutcome = NonNullable<BattleState['outcome']>;

export function battleOutcomeLabel(outcome: BattleState['outcome']): string {
  return outcome === 'victory' ? '胜利' : outcome === 'defeat' ? '失败' : outcome === 'repelled' ? '击退' : outcome === 'draw' ? '平局' : '未结算';
}

export interface BattleActor {
  uid: string;
  side: 'ally' | 'enemy';
  girlId?: string;
  name: string;
  codename?: string;
  portrait: string;
  color: string;
  expression: Expression;
  down: boolean;
  downRound: number | null;
  monster?: MonsterTemplate;
  portraitSpec?: PortraitSpec;
  speakable: boolean;
}

function downRoundMap(battle: BattleState): Map<string, number> {
  const map = new Map<string, number>();
  for (const frame of [...(battle.frames ?? [])].sort((a, b) => a.round - b.round)) {
    for (const unit of frame.units) if (unit.down && !map.has(unit.uid)) map.set(unit.uid, frame.round);
  }
  for (const unit of battle.units) if (unit.down && !map.has(unit.uid)) map.set(unit.uid, Math.max(1, battle.round || battle.rounds));
  return map;
}

/** 战斗单位转成叙事可用角色；只有带 girlId 与立绘的人能成为说话者。 */
export function battleActors(battle: BattleState): BattleActor[] {
  const downs = downRoundMap(battle);
  return battle.units.map(unit => {
    const speakable = Boolean(unit.girlId && unit.portrait);
    return {
      uid: unit.uid,
      side: unit.side,
      girlId: unit.girlId,
      name: unit.name,
      codename: unit.codename,
      portrait: unit.portrait,
      color: unit.color,
      expression: unit.expression ?? 'calm',
      down: unit.down,
      downRound: downs.get(unit.uid) ?? (unit.down ? Math.max(1, battle.round || battle.rounds) : null),
      monster: unit.monster,
      portraitSpec: unit.portraitSpec,
      speakable,
    };
  });
}

export function battleCast(battle: BattleState): BattleActor[] {
  return battleActors(battle).filter(actor => actor.speakable);
}

export function totalBattleRounds(battle: BattleState): number {
  return Math.max(1, battle.rounds || battle.round || 1);
}

function eventLine(event: BattleState['events'][number], withRound = true): string {
  const target = event.targets.length ? ` → ${event.targets.join('、')}` : '';
  const amount = event.amount ? `，${event.resource === 'spirit' ? '心防' : '血量'} ${event.amount}` : '';
  const note = event.note ? `（${event.note}）` : '';
  return `${withRound ? `第 ${event.round} 回合，` : ''}${event.actor} 使用「${event.skillName}」${target}${event.hit ? '' : '，落空'}${amount}${note}`;
}

function actorSummary(actor: BattleActor): string {
  const role = actor.side === 'ally' ? '我方' : '敌方';
  const down = actor.down ? `，第 ${actor.downRound ?? '?'} 回合倒下` : '';
  const code = actor.codename ? `（${actor.codename}）` : '';
  return `${role} ${actor.name}${code}${down}`;
}

/** 给模型的战斗摘要；只描述记录中已有的回合、数值与结果。 */
export function battleDigest(battle: BattleState): string {
  const actors = battleActors(battle);
  const total = totalBattleRounds(battle);
  const parts = [
    `战斗：${battle.missionTitle}`,
    `结果：${battleOutcomeLabel(battle.outcome)}；共 ${total} 回合`,
    ...(battle.pollution === undefined ? [] : [`辖区污染 ${battle.pollution} · ${pollutionTierLabel(battle.pollution)}`]),
    `参战：${actors.map(actorSummary).join('；') || '没有留下参战记录'}`,
    '逐回合记录：',
  ];
  const events = battle.events.slice(0, 160);
  if (!events.length) parts.push('（没有可读的回合事件）');
  for (const event of events) parts.push(eventLine(event));
  const notes = actors.filter(actor => actor.downRound !== null);
  if (notes.length) parts.push(`倒下：${notes.map(actor => `${actor.name}${actor.side === 'enemy' ? '（敌方）' : ''} 第 ${actor.downRound} 回合`).join('；')}`);
  if (battle.rewards) parts.push(`奖励：星砂 ${battle.rewards.gold}，经验 ${battle.rewards.exp}，羁绊 ${battle.rewards.bond}`);
  if (battle.scars?.length) parts.push(`疤痕：${battle.scars.map(scar => scar.name).join('、')}`);
  if (battle.fatal?.length) parts.push(`致命：${battle.fatal.join('、')}`);
  return parts.join('\n');
}

/**
 * 连贯札记用的战斗摘要：讲清「谁用什么做了什么、成没成」，不带回合与数值。
 *
 * v33 起保留技能名与用途分类：支援/治疗/自身增益不再被误写成「向队友出手」，
 * 模型也能看出这一手是攻击、护持还是回复。只禁止伤害数值，不再禁止技能名。
 */
export function battleStoryDigest(battle: BattleState): string {
  const actors = battleActors(battle);
  const byUid = new Map(actors.map(actor => [actor.uid, actor]));
  const name = (uid: string) => byUid.get(uid)?.name ?? uid;
  const outcome = battleOutcomeLabel(battle.outcome);
  const parts = [
    `战斗：${battle.missionTitle}。结果：${outcome}。`,
    `参战：${actors.map(actor => `${actor.side === 'ally' ? '我方' : '敌方'}${actor.name}${actor.down ? '（倒下了）' : ''}`).join('、') || '没有留下参战记录'}。`,
  ];
  if (battle.pollution !== undefined) parts.push(`环境：辖区污染 ${pollutionTierLabel(battle.pollution)}。`);
  const describe = (event: BattleState['events'][number]): string => {
    const actor = name(event.actor);
    if (event.skillId === 'trait') return `${actor}的特性发动了`;
    const skill = findSkill(event.skillId);
    const skillName = event.skillName || skill?.name || '一次出手';
    const targets = event.targets.map(name);
    const targetText = targets.length ? targets.join('、') : '空处';
    // 支援类（治疗、护持、增益、净化）不是攻击，绝不能写成「向队友出手」。
    const support = skill ? skill.side !== 'enemy' : targets.every(uid => byUid.get(uid)?.side === byUid.get(event.actor)?.side);
    if (support) {
      const effect = event.note?.includes('恢复') ? '回复'
        : event.note?.includes('心防') ? '护持'
          : skill?.effects?.some(item => item.kind === 'buff') ? '增益'
            : skill?.effects?.some(item => item.kind === 'shield') ? '护盾'
              : skill?.effects?.some(item => item.kind === 'purify') ? '净化'
                : '支援';
      return `${actor}对${targetText}使用「${skillName}」（${effect}）`;
    }
    const hitText = event.hit ? `用「${skillName}」击中${targetText}` : `用「${skillName}」攻向${targetText}，被避开`;
    const spirit = event.resource === 'spirit' ? '，削去对方的心防' : '';
    return `${actor}${hitText}${spirit}`;
  };

  // 每 3 条事件合成一句，避免把整份战报塞给模型；保留开头与最后几条。
  const beats: string[] = [];
  for (let index = 0; index < battle.events.length; index += 3) {
    beats.push(battle.events.slice(index, index + 3).map(describe).join('；'));
  }
  const head = beats.slice(0, 26);
  const tail = beats.length > 34 ? beats.slice(-8) : [];
  parts.push('经过：', ...head.map(line => `- ${line}`));
  if (tail.length) {
    parts.push(`- 中间还有 ${beats.length - head.length - tail.length} 段交手，节奏更快，双方都在换位与试探；`, ...tail.map(line => `- ${line}`));
  }
  const downs = actors.filter(actor => actor.down);
  if (downs.length) parts.push(`倒下：${downs.map(actor => actor.name).join('、')}。`);
  if (battle.scars?.length) parts.push(`战后留下疤痕：${battle.scars.map(scar => scar.name).join('、')}。`);
  parts.push('报酬已经结算；不要写具体星砂数字。');
  return parts.join('\n');
}

export interface BattleNoteDraftScene {
  roundFrom: number;
  roundTo: number;
  title: string;
  narration: string;
  lines: BattleNoteLine[];
}

export interface BattleNoteDraft {
  title: string;
  hook: string;
  summary: string;
  format?: 'continuous';
  narration?: string;
  lines?: BattleNoteLine[];
  scenes: BattleNoteDraftScene[];
}

export interface BattleNoteDraftResult {
  ok: boolean;
  errors: string[];
  note?: BattleNote;
  draft?: BattleNoteDraft;
}

function clean(value: unknown, max = 1200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanLong(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function integer(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : NaN;
}

function noteLength(note: BattleNote): number {
  const texts = [note.title, note.hook, note.summary];
  for (const scene of note.scenes) {
    texts.push(scene.title, scene.narration);
    for (const line of scene.lines) texts.push(line.text);
  }
  return [...texts.join('').replace(/\s+/g, '')].length;
}

export function battleNoteChars(note: BattleNote): number {
  return noteLength(note);
}

function materialize(draft: BattleNoteDraft, battle: BattleState, meta: { source: 'llm' | 'template'; createdAt: string; model?: string; presetId?: string }): BattleNote {
  const scenes: BattleNoteScene[] = draft.scenes.map((scene, index) => ({
    id: `battle-scene-${index + 1}`,
    roundFrom: scene.roundFrom,
    roundTo: scene.roundTo,
    title: scene.title,
    narration: scene.narration,
    lines: scene.lines.map(line => ({ ...line, text: line.text.trim() })),
  }));
  const note: BattleNote = {
    battleId: battle.id,
    format: draft.format,
    title: draft.title,
    hook: draft.hook,
    summary: draft.summary,
    scenes,
    source: meta.source,
    charCount: 0,
    createdAt: meta.createdAt,
    model: meta.model,
    presetId: meta.presetId,
  };
  note.charCount = noteLength(note);
  return note;
}

/** 校验模型草稿：覆盖全部回合、说话者在场且倒下后不再开口、字数与字段受控。 */
export function validateBattleNoteDraft(raw: unknown, battle: BattleState, meta: { createdAt: string; model?: string; presetId?: string }): BattleNoteDraftResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['输出不是 JSON 对象。'] };
  const value = raw as Record<string, unknown>;
  const title = clean(value.title, 80);
  const hook = clean(value.hook, 240);
  const summary = clean(value.summary, 700);
  if (!title) errors.push('缺少标题。');
  if (!hook) errors.push('缺少引子。');
  if (!summary) errors.push('缺少收束摘要。');
  const rawScenes = Array.isArray(value.scenes) ? value.scenes : [];
  const continuous = value.format === 'continuous' || typeof value.narration === 'string';
  if (continuous) {
    const narration = cleanLong(value.narration, MAX_CONTINUOUS_CHARS + 2000);
    const actors = battleActors(battle);
    const byKey = new Map(actors.filter(actor => actor.speakable).map(actor => [`${actor.side}:${actor.girlId}`, actor]));
    const rawLines = Array.isArray(value.lines) ? value.lines : [];
    const lines: BattleNoteLine[] = [];
    for (const [index, rawLine] of rawLines.entries()) {
      if (!rawLine || typeof rawLine !== 'object') { errors.push(`第 ${index + 1} 行不是对象。`); continue; }
      const line = rawLine as Record<string, unknown>;
      const speakerSide = line.speakerSide;
      const speakerId = clean(line.speakerId, 80);
      const expression = clean(line.expression, 20);
      const text = clean(line.text, 240);
      const mode = line.mode === 'thought' ? 'thought' : 'speech';
      if (speakerSide !== 'ally' && speakerSide !== 'enemy') errors.push(`第 ${index + 1} 行缺少 speakerSide。`);
      if (!EXPRESSION_SET.has(expression)) errors.push(`第 ${index + 1} 行的表情无效。`);
      if (!text) errors.push(`第 ${index + 1} 行没有台词。`);
      const actor = speakerSide === 'ally' || speakerSide === 'enemy' ? byKey.get(`${speakerSide}:${speakerId}`) : undefined;
      if (!actor) errors.push(`第 ${index + 1} 行的说话者不在场上，或没有立绘。`);
      const after = Number.isFinite(Number(line.after)) ? Math.max(0, Math.floor(Number(line.after))) : undefined;
      lines.push({ round: 1, speakerSide: speakerSide === 'enemy' ? 'enemy' : 'ally', speakerId, expression: EXPRESSION_SET.has(expression) ? expression as Expression : 'calm', text, mode, after });
    }
    if (lines.length < 4) errors.push('至少需要 4 句台词。');
    if (lines.length > 16) errors.push('台词最多 16 句。');
    if (!narration) errors.push('缺少正文。');
    const numeric = /\d+\s*(点|伤害|回合|%|HP|心防)|第\s*\d+\s*回合/i;
    if (numeric.test(narration) || lines.some(line => numeric.test(line.text))) errors.push('正文或台词里出现了伤害、回合数或数值；改成动作与结果。');
    // v33：技能名不再被禁止，只拦数值。模型可以引用技能名，但不能写伤害/回合数字。
    const chars = [...(narration + lines.map(line => line.text).join('')).replace(/\s+/g, '')].length;
    if (chars < MIN_CONTINUOUS_CHARS) errors.push(`札记只有 ${chars} 字，至少需要 ${MIN_CONTINUOUS_CHARS} 字。`);
    if (chars > MAX_CONTINUOUS_CHARS) errors.push(`札记有 ${chars} 字，超出 ${MAX_CONTINUOUS_CHARS} 字上限。`);
    if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
    const draft: BattleNoteDraft = { title, hook, summary, format: 'continuous', narration, lines, scenes: [{ roundFrom: 1, roundTo: totalBattleRounds(battle), title: '', narration, lines }] };
    const note = materialize(draft, battle, { source: 'llm', createdAt: meta.createdAt, model: meta.model, presetId: meta.presetId });
    return { ok: true, errors: [], note, draft };
  }
  if (rawScenes.length < 3 || rawScenes.length > 5) errors.push('场景必须是 3–5 场。');
  const actors = battleActors(battle);
  const byKey = new Map(actors.filter(actor => actor.speakable).map(actor => [`${actor.side}:${actor.girlId}`, actor]));
  const total = totalBattleRounds(battle);
  const scenes: BattleNoteDraftScene[] = [];
  for (const [index, item] of rawScenes.entries()) {
    if (!item || typeof item !== 'object') { errors.push(`第 ${index + 1} 场不是对象。`); continue; }
    const scene = item as Record<string, unknown>;
    const roundFrom = integer(scene.roundFrom);
    const roundTo = integer(scene.roundTo);
    const sceneTitle = clean(scene.title, 80);
    const narration = clean(scene.narration, 1600);
    if (!Number.isFinite(roundFrom) || !Number.isFinite(roundTo) || roundFrom < 1 || roundTo < roundFrom || roundTo > total) {
      errors.push(`第 ${index + 1} 场回合范围无效。`);
      continue;
    }
    if (!sceneTitle) errors.push(`第 ${index + 1} 场缺少标题。`);
    if (!narration) errors.push(`第 ${index + 1} 场缺少旁白。`);
    const previous = scenes[scenes.length - 1];
    if (!previous && roundFrom !== 1) errors.push('第一场必须从第 1 回合开始。');
    if (previous && roundFrom !== previous.roundTo + 1) errors.push(`第 ${index + 1} 场与上一场之间的回合不连续。`);
    const rawLines = Array.isArray(scene.lines) ? scene.lines : [];
    const lines: BattleNoteLine[] = [];
    for (const [lineIndex, rawLine] of rawLines.entries()) {
      if (!rawLine || typeof rawLine !== 'object') { errors.push(`第 ${index + 1} 场第 ${lineIndex + 1} 行不是对象。`); continue; }
      const line = rawLine as Record<string, unknown>;
      const round = integer(line.round);
      const speakerSide = line.speakerSide;
      const speakerId = clean(line.speakerId, 80);
      const expression = clean(line.expression, 20);
      const text = clean(line.text, 240);
      const mode = line.mode === 'thought' ? 'thought' : 'speech';
      if (!Number.isFinite(round) || round < roundFrom || round > roundTo) errors.push(`第 ${index + 1} 场第 ${lineIndex + 1} 行的回合不在本场范围内。`);
      if (speakerSide !== 'ally' && speakerSide !== 'enemy') errors.push(`第 ${index + 1} 场第 ${lineIndex + 1} 行缺少 speakerSide。`);
      if (!EXPRESSION_SET.has(expression)) errors.push(`第 ${index + 1} 场第 ${lineIndex + 1} 行的表情无效。`);
      if (!text) errors.push(`第 ${index + 1} 场第 ${lineIndex + 1} 行没有台词。`);
      const actor = speakerSide === 'ally' || speakerSide === 'enemy' ? byKey.get(`${speakerSide}:${speakerId}`) : undefined;
      if (!actor) errors.push(`第 ${index + 1} 场第 ${lineIndex + 1} 行的说话者不在场上，或没有立绘。`);
      else if (actor.downRound !== null && Number.isFinite(round) && round > actor.downRound) errors.push(`${actor.name}在第 ${actor.downRound} 回合已倒下，不能在第 ${round} 回合说话。`);
      lines.push({
        round: Number.isFinite(round) ? round : roundFrom,
        speakerSide: speakerSide === 'enemy' ? 'enemy' : 'ally',
        speakerId,
        expression: EXPRESSION_SET.has(expression) ? expression as Expression : 'calm',
        text,
        mode,
      });
    }
    scenes.push({ roundFrom, roundTo, title: sceneTitle, narration, lines });
  }
  if (scenes.length) {
    if (scenes[scenes.length - 1].roundTo !== total) errors.push(`最后一场必须覆盖到第 ${total} 回合。`);
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
  const draft: BattleNoteDraft = { title, hook, summary, scenes };
  const note = materialize(draft, battle, { source: 'llm', createdAt: meta.createdAt, model: meta.model, presetId: meta.presetId });
  if (note.charCount < MIN_NOTE_CHARS) errors.push(`札记只有 ${note.charCount} 字，至少需要 ${MIN_NOTE_CHARS} 字。`);
  if (note.charCount > MAX_NOTE_CHARS) errors.push(`札记有 ${note.charCount} 字，超出 ${MAX_NOTE_CHARS} 字上限。`);
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], note, draft };
}

/** 无 Key / 生成失败时的据实简报：只有旁白，不编造台词。 */
export function buildBattleBrief(battle: BattleState, createdAt = new Date().toISOString()): BattleNote {
  const total = totalBattleRounds(battle);
  const count = Math.min(3, total);
  const actors = battleActors(battle);
  const events = battle.events;
  const scenes: BattleNoteScene[] = [];
  for (let index = 0; index < count; index += 1) {
    // 按比例切回合，避免 4 回合 / 3 场时最后一场从第 5 回合开始。
    const roundFrom = Math.floor(index * total / count) + 1;
    const roundTo = Math.floor((index + 1) * total / count);
    const sceneEvents = events.filter(event => event.round >= roundFrom && event.round <= roundTo);
    const eventText = sceneEvents.slice(0, 5).map(event => eventLine(event, false)).join('；');
    const ally = actors.filter(actor => actor.side === 'ally');
    const enemy = actors.filter(actor => actor.side === 'enemy');
    const down = actors.filter(actor => actor.downRound !== null && actor.downRound >= roundFrom && actor.downRound <= roundTo);
    const paragraphs = [
      `第 ${roundFrom}${roundTo > roundFrom ? `–${roundTo}` : ''} 回合。${eventText || '这一段没有留下可读的出手记录，只能从阵型与剩余状态推断双方都在试探。'}`,
      `我方${ally.length ? `还有 ${ally.filter(actor => !actor.down).length} 人站着` : '没有留下完整名册'}；敌方${enemy.length ? `仍有 ${enemy.filter(actor => !actor.down).length} 个单位在场上` : '没有可辨认的编制'}。${down.length ? `${down.map(actor => `${actor.name}在第 ${actor.downRound} 回合倒下`).join('，')}。` : '这一段没有人彻底倒下，但每次交换都在消耗还能站住的人。'}`,
    ];
    scenes.push({
      id: `battle-scene-${index + 1}`,
      roundFrom,
      roundTo,
      title: index === 0 ? '接敌' : index === count - 1 ? '收束' : `第 ${index + 1} 段`,
      narration: paragraphs.join('\n\n'),
      lines: [],
    });
  }
  const title = `战斗简报：${battle.missionTitle}`;
  const hook = '完整的战斗札记还没有写。以下只把记录里已经发生的事按回合整理出来，不补写没有出现过的对白。';
  const summary = `结果是${battleOutcomeLabel(battle.outcome)}。这场战斗持续 ${total} 回合，记录里留下了 ${events.length} 条出手事件。${battle.scars?.length ? `战斗结束后新增疤痕：${battle.scars.map(scar => scar.name).join('、')}。` : '没有新的疤痕记录。'}`;
  const note: BattleNote = {
    battleId: battle.id, title, hook, summary, scenes,
    source: 'template', charCount: 0, createdAt,
  };
  note.charCount = noteLength(note);
  return note;
}

/** 给模型输出做一次轻量修整：把场景 id、表情与说话阵营补齐，再走严格校验。 */
export function normalizeBattleNoteDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const value = raw as Record<string, unknown>;
  const scenes = Array.isArray(value.scenes) ? value.scenes.map(scene => {
    if (!scene || typeof scene !== 'object') return scene;
    const item = scene as Record<string, unknown>;
    const lines = Array.isArray(item.lines) ? item.lines.map(line => {
      if (!line || typeof line !== 'object') return line;
      const entry = line as Record<string, unknown>;
      return { ...entry, mode: entry.mode === 'thought' ? 'thought' : 'speech' };
    }) : [];
    return { ...item, lines };
  }) : [];
  return { ...value, scenes };
}
