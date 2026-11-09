import { loadBalance } from '../balance.ts';
import { REMOTE_CALL_COST } from '../contracts.ts';
import { absoluteMinutes } from '../shift.ts';
import type { ActionResult, DialogueLine, DialogueReply, Expression, GameAction, GameState, Girl } from '../types.ts';
import { districtOfMission } from './battle.ts';
import { book, clone, dateLabel, findGirl } from './core.ts';
import { relationshipStage, statusLabels, workLabels } from './labels.ts';
import { inWithdrawal, squadLimit } from './roster.ts';
import { newsCastPool, sanitizeCityNews } from '../cityNews.ts';
import { failStoryMission } from './storyRun.ts';
// v35 从 src/game.ts 拆出：派遣、陪伴与聊天。

export function careRecovery(girl: Girl, mode: 'resting'): void {
  if (mode === 'resting') {
    // 到点了：直接落到目标值（中途已经按比例回落过）。
    const target = girl.restProgress;
    if (target) {
      girl.fatigue = target.toFatigue;
      girl.corruption = target.toCorruption;
    } else {
      const plan = restPlanOf(girl);
      girl.fatigue = plan.fatigueTo;
      girl.corruption = plan.corruptionTo;
    }
  }
  girl.restProgress = undefined;
  girl.status = 'idle'; girl.remaining = 0;
}

/**
 * 这次休息要睡多久、睡到哪儿（v90）。
 *
 * 规则改成「每小时回 20 点，一直回到疲劳 ≤ 20 才算完」，所以时长不再固定 90 分钟，
 * 而是按她当前有多累算出来。疤痕里的「恢复变慢」按每小时恢复量打折。
 */
export function restPlanOf(girl: Pick<Girl, 'fatigue' | 'corruption' | 'scars'>): {
  perHour: number;
  threshold: number;
  minutes: number;
  fatigueTo: number;
  corruptionTo: number;
  exhausted: boolean;
} {
  const rules = loadBalance();
  const penalty = girl.scars.reduce((sum, s) => sum + (s.effect.kind === 'fatigueRecovery' ? s.effect.amount : 0), 0);
  const perHour = Math.max(1, Math.round(rules.dormFatiguePerHour + penalty));
  const threshold = Math.max(0, Math.round(rules.dormRestExitFatigue));
  const fatigueTo = Math.min(girl.fatigue, threshold);
  const need = Math.max(0, girl.fatigue - threshold);
  return {
    perHour,
    threshold,
    minutes: Math.max(1, Math.ceil(need / perHour * 60)),
    fatigueTo,
    corruptionTo: Math.max(0, (girl.corruption ?? 0) - Math.max(0, Math.round(rules.dormRestCorruption))),
    exhausted: need <= 0,
  };
}

export function dispatch(state: GameState, girlIds: string[], missionId: string): ActionResult {
  const next = clone(state);
  const mission = next.missions.find(m => m.id === missionId);
  if (!mission || mission.status !== 'open') return { state, ok: false, message: '这项委托当前无法接取。' };
  const missingCast = (mission.storyCastIds ?? []).filter(id => !girlIds.includes(id));
  if (missingCast.length) {
    const names = missingCast.map(id => findGirl(next, id)?.name ?? id).join('、');
    return { state, ok: false, message: `这份委托要求${names}同行，先把她编进小队。` };
  }
  if (mission.requiredGirlId && !girlIds.includes(mission.requiredGirlId)) {
    const partner = findGirl(next, mission.requiredGirlId) ?? next.candidates.find(girl => girl.id === mission.requiredGirlId);
    return { state, ok: false, message: `这份委托要求${partner?.name ?? '指定的契约者'}同行，先把她编进小队。` };
  }
  if (mission.deadlineAt !== undefined && absoluteMinutes(next.day, next.minutes) >= mission.deadlineAt) {
    mission.status = 'expired';
    if (mission.storylineId) failStoryMission(next, mission, '超过期限');
    return { state: next, ok: false, message: `「${mission.title}」已过接取时限，委托自动撤销。` };
  }
  const squad = girlIds.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
  if (squad.length !== girlIds.length || !squad.length) return { state, ok: false, message: '请选择可出勤的契约者。' };
  if (squad.length > squadLimit(mission)) return { state, ok: false, message: `${workLabels[mission.work]}最多派遣 ${squadLimit(mission)} 人。` };
  for (const girl of squad) {
    if (girl.left) return { state, ok: false, message: `${girl.name}已经解除了契约，不能再出勤。` };
    if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}当前${statusLabels[girl.status]}，无法出勤。` };
    if (inWithdrawal(girl)) return { state, ok: false, message: `${girl.name}正在断药期，无法出勤。请先使用月蚀抑制剂。` };
    if (girl.hp < 25) return { state, ok: false, message: `${girl.name}的血量过低，请先治疗。` };
    if (girl.fatigue >= 80) return { state, ok: false, message: `${girl.name}的疲劳过高，请先休息。` };
  }
  mission.status = 'active';
  mission.squad = squad.map(g => g.id);
  mission.girlId = squad[0].id;
  for (const girl of squad) {
    girl.status = 'mission'; girl.remaining = mission.duration; girl.missionId = mission.id;
  }
  next.logs.unshift({ id: `log-dispatch-${mission.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'dispatch', text: `${squad.map(g => g.name).join('、')}已前往${districtOfMission(mission).name}的「${mission.title}」。${mission.work === 'combat' ? `魔物：${(mission.enemyIds ?? []).length} 体，预计 ${mission.rounds} 轮。` : '以调查与共情为主，不进入战斗。'}` });
  return { state: next, ok: true, message: `${squad.map(g => g.name).join('、')}已出发。` };
}

export function care(state: GameState, girlId: string, mode: 'resting'): ActionResult {
  const next = clone(state); const girl = findGirl(next, girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}正在${statusLabels[girl.status]}，无法安排照顾。` };
  if (mode === 'resting') {
    const plan = restPlanOf(girl);
    if (plan.exhausted && (girl.corruption ?? 0) <= plan.corruptionTo) {
      return { state, ok: false, message: `${girl.name}的疲劳已经低于 ${plan.threshold}，不用再休息了。` };
    }
    girl.status = 'resting'; girl.remaining = plan.minutes;
    girl.restProgress = {
      fromFatigue: girl.fatigue,
      toFatigue: plan.fatigueTo,
      fromCorruption: girl.corruption ?? 0,
      toCorruption: plan.corruptionTo,
      minutes: plan.minutes,
    };
    next.logs.unshift({ id: `log-rest-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}回到晚安宿舍休息（约 ${plan.minutes} 分钟，每小时恢复 ${plan.perHour} 点疲劳，降到 ${plan.threshold} 就醒）。` });
    return { state: next, ok: true, message: `${girl.name}开始休息，约 ${plan.minutes} 分钟后（疲劳 ≤ ${plan.threshold}）自动结束。` };
  }
  return { state, ok: false, message: '宿舍只负责休息。受伤请去诊所。' };
}

export function talkResponse(girl: Girl, text: string, bond: number): DialogueLine[] {
  const stage = relationshipStage(bond);
  if (girl.id === 'wu' && /猫|咪|尾巴/.test(text)) return [{ text: '「帽子里的猫说，它记得你上次留下的脚步声。」', action: '雾眠把帽子掀开一角，里面蜷着一只不属于任何品种的小猫。', expression: 'smile' }];
  if (/累|休息|睡/.test(text)) return stage >= 4
    ? [{ text: '「有一点。不过你在这里的话，我可以再撑一会儿。」', action: '她把额头轻轻靠在桌沿。', expression: 'shy' }]
    : [{ text: '「我还好。谢谢关心。」', action: '她点点头，没有再多说。', expression: 'calm' }];
  if (/星星|月|夜/.test(text)) return stage >= 4
    ? [{ text: '「今晚的月亮很像你说话时的停顿。」', action: '她望向窗外，耳尖有一点红。', expression: 'shy' }]
    : [{ text: '「夜空很安静。适合工作。」', action: '她把视线移回档案。', expression: 'calm' }];
  if (/对不起|抱歉/.test(text)) return stage >= 5
    ? [{ text: '「不要为已经发生的事道歉。你还在，就够了。」', action: '她合上手里的档案，声音比刚才轻。', expression: 'sad' }]
    : [{ text: '「没关系。真的。」', action: '她停了一下，又补了一句，「至少现在没关系。」', expression: 'sad' }];
  if (stage >= 6) return [
    { text: `「你来了。」${girl.name}没有抬头。`, action: '她把身边的位置往你这边挪了挪。', expression: 'smile' },
    { text: '「今天也想听你说说话。」', expression: 'shy' },
  ];
  if (stage >= 5) return [
    { text: `「嗯。」${girl.name}把杯子推到你面前。`, action: '杯沿还留着她掌心的温度。', expression: 'smile' },
    { text: '「先喝点热的。剩下的，慢慢说。」', expression: 'calm' },
  ];
  if (stage >= 3) return [{ text: `「我在听。」${girl.name}合上手里的档案，「不过，如果你只是路过，也没关系。」`, action: '她把椅子转过来，正对着你。', expression: 'calm' }];
  return [{ text: `「……知道了。」${girl.name}的语气很轻，像是在确认自己是否应该继续这个话题。`, expression: 'calm' }];
}

export function normalizeDialogueLines(reply: string | DialogueReply | undefined, fallback: DialogueLine[]): DialogueLine[] {
  if (!reply) return fallback;
  if (typeof reply === 'string') {
    const text = reply.trim().slice(0, 400);
    return text ? [{ text, expression: 'calm' }] : fallback;
  }
  const lines = (Array.isArray(reply.lines) ? reply.lines : []).flatMap(line => {
    const text = typeof line?.text === 'string' ? line.text.trim().slice(0, 400) : '';
    const action = typeof line?.action === 'string' ? line.action.trim().slice(0, 80) : '';
    if (!text && !action) return [];
    return [{ text, action: action || undefined, expression: (line?.expression ?? 'calm') as Expression }];
  }).slice(0, 3);
  return lines.length ? lines : fallback;
}

export function talk(state: GameState, girlId: string, text: string, remote = false, reply?: string | DialogueReply): ActionResult {
  const clean = text.trim();
  if (!clean) return { state, ok: false, message: '想说些什么，再按下发送。' };
  const next = clone(state); const girl = findGirl(next, girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (clean.length > 200) return { state, ok: false, message: '一次最多说 200 个字。' };
  if (remote) {
    if (!girl.retired) return { state, ok: false, message: `${girl.name}还没有退役，直接去会客厅找她吧。` };
    if (next.gold < REMOTE_CALL_COST) return { state, ok: false, message: `远程联络需要 ${REMOTE_CALL_COST} 星砂，当前不足。` };
    next.gold -= REMOTE_CALL_COST; book(next, next.day, -REMOTE_CALL_COST);
    const firstToday = girl.lastTalkDay !== next.day;
    const gain = firstToday ? 1 : 0;
    girl.lastTalkDay = next.day; girl.talksToday = firstToday ? 1 : (girl.talksToday ?? 0) + 1;
    girl.bond = Math.min(100, girl.bond + gain);
    const messages = next.messages[girl.id] ?? [];
    messages.push({ role: 'player', text: clean });
    const local = !reply;
    const lines = normalizeDialogueLines(reply, talkResponse(girl, clean, girl.bond));
    if (local) lines[0] = { ...lines[0], text: `（电话那头有很轻的电流声）${lines[0].text}` };
    const burstId = `talk-${next.day}-${next.minutes}-${girl.id}-${messages.length}`;
    for (const line of lines) messages.push({ role: 'girl', text: line.text, action: line.action, expression: line.expression, burstId });
    next.messages[girl.id] = messages.slice(-60);
    next.logs.unshift({ id: `log-call-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'relationship', text: `与退休在家的${girl.name}通了一次电话（${REMOTE_CALL_COST} 星砂）。`, delta: -REMOTE_CALL_COST });
    return { state: next, ok: true, message: gain ? `电话接通了。与${girl.name}的羁绊 +1。` : `电话接通了，但今晚已经聊过很久。` };
  }
  if (girl.retired) return { state, ok: false, message: `${girl.name}已经退役，改用远程联络吧。` };
  if (girl.status === 'mission') return { state, ok: false, message: `${girl.name}正在出勤，等她回来再聊吧。` };
  if (girl.status === 'expedition') return { state, ok: false, message: `${girl.name}正在星象台远行，暂时联络不上。` };
  const count = girl.lastTalkDay === next.day ? (girl.talksToday ?? 0) : 0;
  const assistantBonus = next.assistantId === girl.id ? 1 : 0;
  const gain = count < 3 ? 2 + assistantBonus : 0;
  girl.lastTalkDay = next.day; girl.talksToday = count + 1;
  girl.bond = Math.min(100, girl.bond + gain);
  const messages = next.messages[girl.id] ?? [];
  messages.push({ role: 'player', text: clean });
  const lines = normalizeDialogueLines(reply, talkResponse(girl, clean, girl.bond));
  const burstId = `talk-${next.day}-${next.minutes}-${girl.id}-${messages.length}`;
  for (const line of lines) messages.push({ role: 'girl', text: line.text, action: line.action, expression: line.expression, burstId });
  next.messages[girl.id] = messages.slice(-60);
  if (next.whisperUnread?.[girl.id]) delete next.whisperUnread[girl.id];
  return { state: next, ok: true, message: gain ? `与${girl.name}的羁绊 +${gain}。` : '今晚已经聊得够多了，明天再继续吧。' };
}

/** markWhispersRead 的动作处理器（v35 从 act 拆出）。 */
export function applyMarkWhispersRead(state: GameState, action: Extract<GameAction, { type: 'markWhispersRead' }>): ActionResult {
      if (!state.whisperUnread?.[action.girlId]) return { state, ok: true, message: '' };
      const next = clone(state);
      if (next.whisperUnread) delete next.whisperUnread[action.girlId];
      return { state: next, ok: true, message: '' };
}

/** setCityNews 的动作处理器：把叙事者或本地规则写好的播报存进存档；传 null 清空。 */
export function applySetCityNews(state: GameState, action: Extract<GameAction, { type: 'setCityNews' }>): ActionResult {
      const next = clone(state);
      // 只有显式传 null 才清空；模型给出半截数据时保留原来那条，别让播报块闪一下就不见。
      if (action.news === null) {
        delete next.cityNews;
        return { state: next, ok: true, message: '已清空城市新闻。' };
      }
      const news = sanitizeCityNews(action.news, next.day);
      if (!news) return { state, ok: false, message: '这条播报没有可用的条目，保留原来的播报。' };
      next.cityNews = news;
      return { state: next, ok: true, message: '城市新闻已更新。' };
}

/** setNewsHost（v167）：换今晚的主持人。换了就把当晚那档作废，等下一次刷新按新主持重开。 */
export function applySetNewsHost(state: GameState, action: Extract<GameAction, { type: 'setNewsHost' }>): ActionResult {
  const next = clone(state);
  const person = newsCastPool(next).find(entry => entry.id === action.girlId);
  if (!person) return { state, ok: false, message: '这个人今晚不在现场，换不了主持。' };
  next.newsHostId = person.id;
  delete next.cityNews;
  return { state: next, ok: true, message: `${person.name}接下今晚的主持。` };
}

/** rollNewsCast（v179）：手动刷新时换一批嘉宾、换一块辖区、换要谈的事。 */
export function applyRollNewsCast(state: GameState): ActionResult {
  const next = clone(state);
  next.newsRoll = ((next.newsRoll ?? 0) + 1) % 100000;
  return { state: next, ok: true, message: `节目单翻到第 ${next.newsRoll + 1} 版。` };
}

/** addWhisper 的动作处理器（v35 从 act 拆出）。 */
export function applyAddWhisper(state: GameState, action: Extract<GameAction, { type: 'addWhisper' }>): ActionResult {
      const job = state.whisperQueue?.find(entry => entry.id === action.jobId);
      if (!job) return { state, ok: false, message: '这条私语已经处理过了。' };
      const girl = findGirl(state, job.girlId);
      if (!girl) return { state, ok: false, message: '找不到发消息的契约者。' };
      const lines = action.lines?.length
        ? normalizeDialogueLines({ lines: action.lines }, [])
        : normalizeDialogueLines(action.text, []);
      if (!lines.length) return { state, ok: false, message: '模型没有返回可用的私语。' };
      const next = clone(state);
      next.whisperQueue = (next.whisperQueue ?? []).filter(entry => entry.id !== job.id);
      const messages = next.messages[girl.id] ?? [];
      for (const line of lines) messages.push({ role: 'girl', text: line.text, action: line.action, expression: line.expression, whisper: true, at: dateLabel(next.day, next.minutes), burstId: job.id });
      next.messages[girl.id] = messages.slice(-60);
      next.whisperUnread = { ...(next.whisperUnread ?? {}), [girl.id]: (next.whisperUnread?.[girl.id] ?? 0) + 1 };
      next.logs.unshift({ id: `log-whisper-${job.id}`, time: dateLabel(next.day, next.minutes), kind: 'relationship', text: `${girl.name}发来一条灯下私语。` });
      return { state: next, ok: true, message: `${girl.name}给你发了一条消息。` };
}

/** dropWhisper 的动作处理器（v35 从 act 拆出）。 */
export function applyDropWhisper(state: GameState, action: Extract<GameAction, { type: 'dropWhisper' }>): ActionResult {
      if (!state.whisperQueue?.some(entry => entry.id === action.jobId)) return { state, ok: true, message: '' };
      const next = clone(state);
      next.whisperQueue = (next.whisperQueue ?? []).filter(entry => entry.id !== action.jobId);
      next.logs.unshift({ id: `log-whisper-drop-${action.jobId}`, time: dateLabel(next.day, next.minutes), kind: 'relationship', text: `一条灯下私语没能写出来：${action.reason ? action.reason.slice(0, 80) : '模型没有返回内容'}。` });
      return { state: next, ok: true, message: '' };
}

export function finalizeRests(state: GameState): number {
  let done = 0;
  for (const girl of state.girls) {
    if (girl.status !== 'resting' || girl.remaining > 0) continue;
    careRecovery(girl, 'resting');
    done += 1;
    state.logs.unshift({
      id: `log-rest-done-${girl.id}-${state.day}-${state.minutes}`,
      time: dateLabel(state.day, state.minutes), kind: 'care',
      text: `${girl.name}睡够了，疲劳回到 ${girl.fatigue}，醒来时天还没亮。`,
    });
  }
  return done;
}


