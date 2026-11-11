import { outfitBrief } from './outfitBrief.ts';
import type { Girl, GameState, MissionRun, Storyline } from './types.ts';
import { recentMissionRuns } from './missionHistory.ts';
import { relationshipStage, stageLabels, statLabels, statusLabels, workLabels } from './rules/labels.ts';
import { factionTagLabel } from './factions.ts';
import { voiceLine } from './voice.ts';
import { activePersonality } from './personality.ts';
import { getItem } from './content/items.ts';
import { skills } from './content/skills.ts';
import { promptTokens } from './tokens.ts';

/**
 * 一条宏的默认字数预算（token 估算由 tokens.ts 给）。
 *
 * v239：800 会把「特性 / 心愿 / 关系」整段裁掉——这 3 条是模型判断她性格与立场最需要的部分。
 * 提到 2000 之后，正常卡（含 7 条特性、9 位同伴）整份装得下，不再截断。
 */
export const DOSSIER_BUDGET = 2000;
export const BRIEF_BUDGET = 150;

const OUTCOME_LABEL: Record<string, string> = {
  victory: '胜利', success: '成功', defeat: '失败', failure: '失败', repelled: '暂时击退', draw: '平局',
};

const SCAR_KIND: Record<string, string> = { mental: '精神', physical: '身体' };

function bondStage(bond: number): string {
  return stageLabels[relationshipStage(bond)] ?? '平常';
}

/** 誓约 / 婚礼状态：档案、名册与剧情简报共用同一句话。 */
export function oathStatusText(girl: Pick<Girl, 'oath' | 'wedding'>): string {
  if (!girl.oath) return '';
  return girl.wedding
    ? `已与所长缔结誓约（第 ${girl.oath.day} 日），并在第 ${girl.wedding.day} 日于${girl.wedding.placeName}举行婚礼`
    : `已与所长缔结誓约（第 ${girl.oath.day} 日），尚未举行婚礼`;
}

/** 按预算裁行：从尾部裁（older=false 时从头部裁），留下省略说明。 */
function fitLines(lines: string[], budget: number, opts: { fromEnd: boolean; omitted: (count: number) => string }): string {
  const kept = [...lines];
  let text = kept.join('\n');
  let cut = 0;
  while (kept.length > 1 && promptTokens(text) > budget) {
    if (opts.fromEnd) kept.pop();
    else kept.shift();
    cut += 1;
    text = kept.join('\n');
  }
  return cut > 0 ? `${text}\n${opts.omitted(cut)}` : text;
}

function skillLine(girl: Girl): string {
  const names = girl.skills
    .map(id => skills.find(skill => skill.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length ? names.join('、') : '未记录';
}

function itemLine(id: string | undefined): string {
  if (!id) return '';
  const item = getItem(id);
  return item ? `${item.name}（${item.slot === 'weapon' ? '法器' : '护符'}）` : '';
}

/** 她的全量档案：静态设定 + 此刻状态 + 关系与契约。brief 只留身份 / 性情 / 关系 / 心愿。 */
export function dossierOf(girl: Girl, state?: GameState, opts: { brief?: boolean; role?: string } = {}): string {
  const oath = oathStatusText(girl);
  const bondText = `对所长 ${girl.bond}/100（${bondStage(girl.bond)}）${oath ? `；${oath}` : ''}`;
  const peers = Object.entries(girl.relationships ?? {})
    .map(([id, value]) => {
      const peer = state ? [...state.girls, ...state.candidates, ...state.memorial.map(entry => entry.girl)].find(item => item.id === id) : undefined;
      return peer ? `${peer.name} ${value}/100（${bondStage(value)}）` : '';
    })
    .filter(Boolean);
  // 名册里的首领/随从不是契约者：说清她的位置，别让模型把她写成所长的部下。
  const role = opts.role;
  // 名册投影的 title 本身就是座位（「月蚀庭首领」），别再把同一个词接一遍。
  const roleSuffix = role ? (girl.title === role ? '' : `· ${role}`) : girl.leader ? '· 一方首领' : '';
  const identity = [
    `身份：${girl.name}（${girl.id}）· 代号「${girl.codename}」· ${girl.title}${roleSuffix}`,
    role
      ? `出身 ${factionTagLabel(girl.factionTag)}；此刻是${role}，她有自己的立场与辖区，和事务所只是往来关系，不是你的契约者。`
      : `出身 ${factionTagLabel(girl.factionTag)}；雇主 夜糖事务所`,
  ].join('\n');
  const voice = voiceLine(girl);
  const nature = [
    `性情：性格 ${activePersonality(girl) || '安静'}`,
    `语气参考：「${girl.quote?.trim() || '没有留下出场白'}」`,
    voice,
  ].filter(Boolean).join('；');
  const wish = `心愿：${girl.goal?.trim() || '没有写下来的愿望'}（${girl.goalKind}）`;

  if (opts.brief) {
    return fitLines([identity.split('\n')[0]!, nature, `关系：${bondText}${peers.length ? `；同伴 ${peers.join('、')}` : ''}`, wish], BRIEF_BUDGET, {
      fromEnd: true, omitted: () => '',
    });
  }

  const isRoster = Boolean(role);
  const condition = isRoster ? [] : [
    `此刻：生命 ${girl.hp}/${girl.maxHp} · 心防 ${girl.spirit}/${girl.maxSpirit} · 疲劳 ${girl.fatigue}/100 · 侵蚀 ${girl.corruption ?? 0}/100 · ${statusLabels[girl.status] ?? girl.status}`,
    girl.scars.length ? `疤痕：${girl.scars.map(scar => `${scar.name}（${SCAR_KIND[scar.kind] ?? '身体'}）`).join('、')}` : '疤痕：无',
    girl.conditions.length ? `临时增益：${girl.conditions.map(item => `${item.name}（剩 ${item.remaining} 天）`).join('、')}` : '',
  ].filter(Boolean);
  const contract = isRoster ? '' : [
    `契约：第 ${girl.contractEndDay - (girl.contractDays ?? 0)} 日签约 · 第 ${girl.contractEndDay} 日到期 · 已续约 ${girl.contractRenewals ?? 0} 次`,
    girl.pensionMissed ? `退休金欠缴 ${girl.pensionMissed} 期` : '',
  ].filter(Boolean).join('；');
  const gear = [itemLine(girl.equipment?.weapon), itemLine(girl.equipment?.charm)].filter(Boolean);
  const relation = isRoster
    ? `关系：她是${role}，与所长只有这一夜的往来，没有契约、也不听事务所调遣`
    : `关系：${bondText}${peers.length ? `；与同伴的关系：${peers.join('、')}` : '；与同伴的关系：还没有特别亲近的人'}`;

  const lines = [
    identity,
    `外形：${girl.appearance?.trim() || '不详'}；${girl.witch ? '魔女形态' : '当前服装'}：${outfitBrief(girl) || (girl.witch ? '侵蚀之后的样子没有写下来' : '值夜制服')}（${girl.witch ? '第五格 · 魔女化' : girl.wardrobe.find(outfit => outfit.id === girl.outfitId)?.name ?? '常服'}）`,
    nature,
    `能力：${girl.element}·${girl.archetype ?? '未定职阶'} · Lv.${girl.level} · 四维 ${Object.entries(girl.stats).map(([key, value]) => `${statLabels[key as keyof typeof statLabels] ?? key} ${value}`).join(' / ')}`,
    `技能：${skillLine(girl)}`,
    `特性：${girl.traits.length ? girl.traits.map(trait => `${trait.name}（${trait.description || trait.polarity}）`).join('、') : '无'}`,
    ...condition,
    wish,
    relation,
    contract,
    gear.length ? `随身：${gear.join(' · ')}` : '随身：空着（没有法器与护符）',
    '（以上是她到今晚为止的全部设定；这里没列出的事她不知道，不要替她编经历、亲友或秘密。）',
  ].filter(Boolean);
  return fitLines(lines, DOSSIER_BUDGET, { fromEnd: true, omitted: count => `（还有 ${count} 项细节未列出）` });
}

/** 任务经历：结算记录（旧档从战报派生），新的在前。 */
export function missionHistoryText(state: GameState | undefined, girl: Girl, limit: number): string {
  if (!state) return '（未开局，没有出勤记录）';
  const all = recentMissionRuns(state, girl.id, 200);
  if (!all.length) return '最近没有出勤记录。';
  const picked = all.slice(0, Math.max(1, limit));
  const lines = picked.map((run: MissionRun) => {
    const parts = [
      `第 ${run.day} 日「${run.title}」`,
      workLabels[run.work] ?? run.work,
      run.category,
      OUTCOME_LABEL[run.outcome] ?? run.outcome,
    ];
    if (run.reward) parts.push(`报酬 ${run.reward}`);
    return `- ${parts.join(' · ')}`;
  });
  const fitted = fitLines(lines, 300, { fromEnd: true, omitted: count => `（另有 ${count} 次因篇幅未列出）` });
  const rest = all.length - picked.length;
  return rest > 0 ? `${fitted}\n（还有 ${rest} 次更早的出勤未列出）` : fitted;
}

/**
 * 故事线经历：按段号排，写清这一段讲什么、走到了哪个结局。
 *
 * v233：不再复述「已走过」的节点（模型会照着抄成一串流水账），改成把结局那一段的
 * 结局描述整段带进来——她要能顺着自己这条线的收束讲话。
 */
export function storylineHistoryText(state: GameState | undefined, girl: Girl, limit: number): string {
  if (!state) return '（未开局，没有故事线）';
  const all = state.storylines.filter(story => story.girlId === girl.id);
  if (!all.length) return '还没有走过个人故事线。';
  const ordered = [...all].sort((a, b) => (a.slot ?? 1) - (b.slot ?? 1) || a.day - b.day).slice(0, Math.max(1, limit));
  const lines = ordered.map((story: Storyline) => {
    const status = story.status === 'done' ? '已完结' : story.status === 'abandoned' ? '已放弃' : '进行中';
    const current = story.status === 'active' ? story.beats.find(beat => beat.status !== 'done') : undefined;
    // v233：不再复述「已走过」的节点（模型会照抄成一串流水账），改成把结局那一段的结局描述整段带进来。
    // 老存档没有 endingSummary 时，退回蓝图里那个 end 节点写的 summary。
    const endNode = story.graph?.nodes.find(node => node.data.kind === 'end' && node.data.ending === story.ending);
    const endingSummary = story.endingSummary?.trim()
      || (endNode?.data.kind === 'end' ? endNode.data.summary?.trim() ?? '' : '');
    return [
      `- 第 ${story.slot ?? 1} 段「${story.title}」（${status}）：${story.premise?.trim() ?? ''}`,
      story.ending ? `  结局：${story.ending}` : '',
      endingSummary ? `  结局描述：${endingSummary}` : '',
      current ? `  现在停在：${current.title}` : '',
    ].filter(Boolean).join('\n');
  });
  // 结局描述必须完整交给模型：预算按每段 900 tokens 给足，宁可整段省略更早的故事线，也不截断结局。
  const budget = Math.min(2800, Math.max(900, ordered.length * 900));
  return fitLines(lines, budget, { fromEnd: false, omitted: count => `（还有 ${count} 段更早的故事线未列出）` });
}

/** 已结束、写下了摘要的剧情与会议（她参与的），新的在前。 */
export function recentEventLines(state: GameState | undefined, girlId: string, limit: number): string[] {
  if (!state) return [];
  return (state.events ?? [])
    // v176：会议对每位参会者都算「之前发生过的事」。
    .filter(event => event.status === 'done'
      && (event.girlId === girlId || (event.cast ?? []).includes(girlId) || Boolean(event.meeting?.attendeeIds.includes(girlId)))
      && (event.summary ?? '').trim())
    .slice(0, Math.max(1, limit))
    .map(event => `· ${event.title}：${(event.summary ?? '').trim()}`);
}

/**
 * 私人事件回忆（v252）：`{{history.events}}`。
 *
 * 只引用收尾时写下的摘要，不回看原文——原文留在存档里给玩家翻，
 * 提示词只需要「发生过什么」。会议对每位参会者都算一次。
 */
export function eventMemoryText(state: GameState | undefined, girlId: string, limit: number): string {
  if (!state) return '（未开局，没有私人事件）';
  const lines = recentEventLines(state, girlId, limit);
  return lines.length ? lines.join('\n') : '还没有一起经历过的事。';
}

/** 聊天记录：她与所长说过的话，按时间正序取最近 N 条。 */
export function chatHistoryText(state: GameState | undefined, girl: Girl, limit: number): string {
  if (!state) return '（未开局，没有聊天记录）';
  const list = (state.messages[girl.id] ?? []).filter(message => message.role !== 'system');
  if (!list.length) return '还没有聊过。';
  const picked = list.slice(-Math.max(1, limit));
  const lines = picked.map(message => message.role === 'player'
    ? `你：${message.text}`
    : `她：${message.text}${message.action ? `（${message.action}）` : ''}`);
  const omitted = list.length - picked.length;
  const text = fitLines(lines, 420, { fromEnd: false, omitted: count => `（更早的 ${count} 条已省略）` });
  return omitted > 0 ? text : text;
}

/** 战斗经历：最近的战报，胜负、回合与伤害。 */
export function battleHistoryText(state: GameState | undefined, girl: Girl, limit: number): string {
  if (!state) return '（未开局，没有战斗记录）';
  const battles = (state.battles ?? []).filter(battle => battle.units.some(unit => unit.uid === `ally-${girl.id}`)).slice(0, Math.max(1, limit));
  if (!battles.length) return '还没有参加过战斗。';
  const lines = battles.map(battle => {
    const unit = battle.units.find(entry => entry.uid === `ally-${girl.id}`);
    const outcome = OUTCOME_LABEL[battle.outcome ?? 'draw'] ?? '平局';
    const scar = battle.scars?.length ? ` · 留下 ${battle.scars.length} 道疤` : '';
    return `- 第 ${battle.startedAt.day} 日「${battle.missionTitle}」：${outcome} · ${battle.round}/${battle.rounds} 回合 · 造成 ${unit?.dealt ?? 0} / 承受 ${unit?.taken ?? 0} / 治疗 ${unit?.healed ?? 0}${scar}`;
  });
  return fitLines(lines, 260, { fromEnd: true, omitted: count => `（还有 ${count} 场更早的战斗未列出）` });
}

/** 最近参与（对话 / 私语里的短摘要）：任务 + 战斗各取几条。 */
export function recentExperienceText(state: GameState | undefined, girl: Girl, excludeMissionId?: string): string {
  if (!state) return '最近没有出勤记录。';
  const runs = recentMissionRuns(state, girl.id, 6).filter(run => run.missionId !== excludeMissionId).slice(0, 4);
  if (!runs.length) return '最近没有出勤记录。';
  return runs.map(run => `第 ${run.day} 日「${run.title}」${workLabels[run.work] ?? run.work}：${OUTCOME_LABEL[run.outcome] ?? run.outcome}${run.reward ? `，报酬 ${run.reward}` : ''}。`).join('');
}
