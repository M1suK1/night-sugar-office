import type { GameState, Girl, GirlStrain, Incident, LeftReason } from './types.ts';

/** 好感掉到这个数以下算「心已经不在」。（连续 RESIGN_DAYS 天才算） */
export const RESIGN_BOND_CEILING = 25;
/** 疲劳到这个数以上算「撑不住了」。（连续 RESIGN_DAYS 个夜晚） */
export const RESIGN_FATIGUE_FLOOR = 85;
/** 契约款欠到这个数，她会自己开口解约。 */
export const RESIGN_PENSION_DAYS = 7;
/** 条件要连续成立几天才会开口。 */
export const RESIGN_DAYS = 3;
/** 「再想想」给的天数。 */
export const RESIGN_GRACE_DAYS = 2;
/** 挽留的价钱与代价。 */
export const RESIGN_PICK_COST = 600;
export const RESIGN_PICK_BOND = 8;

export const LEFT_REASON_LABEL: Record<LeftReason, string> = {
  bond: '她说不觉得这里需要她了',
  fatigue: '她撑不住了',
  pension: '契约款一直没到账',
};

export function strainOf(girl: Girl): GirlStrain {
  return girl.strain ?? { lowBondDays: 0, highFatigueDays: 0 };
}

/** 已经到「开口要走」的程度了吗。 */
export function resignationPressure(girl: Girl): { reason: LeftReason; days: number } | null {
  if (girl.retired || girl.dead || girl.left) return null;
  if (girl.pensionMissed >= RESIGN_PENSION_DAYS) return { reason: 'pension', days: girl.pensionMissed };
  const strain = strainOf(girl);
  if (strain.highFatigueDays >= RESIGN_DAYS) return { reason: 'fatigue', days: strain.highFatigueDays };
  if (strain.lowBondDays >= RESIGN_DAYS) return { reason: 'bond', days: strain.lowBondDays };
  return null;
}

/** 开门时累计天数：条件在就 +1，条件消失立刻清零。 */
export function tickStrain(state: GameState): void {
  for (const girl of state.girls) {
    if (girl.retired || girl.dead || girl.left) {
      girl.strain = { lowBondDays: 0, highFatigueDays: 0 };
      continue;
    }
    const previous = strainOf(girl);
    girl.strain = {
      lowBondDays: girl.bond < RESIGN_BOND_CEILING ? previous.lowBondDays + 1 : 0,
      highFatigueDays: girl.fatigue >= RESIGN_FATIGUE_FLOOR ? previous.highFatigueDays + 1 : 0,
    };
  }
}

export const resignTemplateId = (girlId: string) => `resign-${girlId}`;

function stamp(state: GameState) {
  return `第${state.day}日 ${String(Math.floor(state.minutes / 60)).padStart(2, '0')}:${String(state.minutes % 60).padStart(2, '0')}`;
}

function resignBody(girl: Girl, reason: LeftReason): string {
  if (reason === 'pension') return `${girl.name}把账本摊在桌上，没有指责，只问了一句：“是不是我这边记错了？”`;
  if (reason === 'fatigue') return `${girl.name}今晚没有换制服。她说手抬不起来了，也说不想再让别人替她收尾。`;
  return `${girl.name}坐在会客厅最里面的那把椅子上，把契约书推回给你，说想听听你怎么想。`;
}

function resignIncident(state: GameState, girl: Girl, reason: LeftReason): Incident {
  return {
    id: `inc-${resignTemplateId(girl.id)}-${state.day}`,
    day: state.day,
    kind: 'girl',
    source: 'rule',
    category: 'scene',
    title: `${girl.name}想走了`,
    body: resignBody(girl, reason),
    girlId: girl.id,
    templateId: resignTemplateId(girl.id),
    status: 'pending',
    options: [
      {
        id: 'persuade',
        label: '留住她',
        hint: `花 ${RESIGN_PICK_COST} 星砂把话说完，羁绊 +${RESIGN_PICK_BOND}`,
        effect: { gold: -RESIGN_PICK_COST, girl: { bond: RESIGN_PICK_BOND } },
      },
      { id: 'wait', label: '再想想', hint: `她再给 ${RESIGN_GRACE_DAYS} 天`, effect: {} },
      { id: 'release', label: '放她走', hint: '当场解除契约，不退还签约费', effect: {} },
    ],
    scene: {
      title: `${girl.name}想走了`,
      narration: resignBody(girl, reason),
      lines: [
        { speakerId: girl.id, speaker: girl.name, text: '我不是在闹。我只是……想确认一下，这里还需要我。' },
      ],
      effect: {},
    },
  } as Incident;
}

/** 离职：编年史与日志各一条，不产生退休金。 */
export function leaveGirl(state: GameState, girl: Girl, reason: LeftReason, day = state.day, minutes = state.minutes): void {
  girl.left = true;
  girl.leftReason = reason;
  girl.status = 'left';
  girl.graceUntilDay = undefined;
  girl.strain = { lowBondDays: 0, highFatigueDays: 0 };
  const label = LEFT_REASON_LABEL[reason];
  state.logs.unshift({
    id: `log-left-${girl.id}-${day}`,
    time: stamp({ day, minutes } as GameState),
    kind: 'relationship',
    text: `${girl.name}解除了契约，理由是${label}。`,
  });
  const id = `chr-left-${girl.id}-${day}`;
  const at = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  if (!state.chronicle.some(entry => entry.id === id)) {
    state.chronicle.unshift({ id, day, at, kind: '少女', title: `${girl.name}离开了事务所`, summary: label });
  }
}

/** 开门时：该警告的警告，宽限期到点的直接走人。 */
export function applyResignations(state: GameState): void {
  for (const girl of [...state.girls]) {
    if (girl.left || girl.retired || girl.dead) continue;
    const templateId = resignTemplateId(girl.id);
    const pending = state.incidents.find(item => item.status === 'pending' && item.templateId === templateId);
    const pressure = resignationPressure(girl);
    if (!pressure) {
      if (pending) {
        pending.status = 'expired';
        pending.expiredBy = 'superseded';
      }
      girl.graceUntilDay = undefined;
      continue;
    }
    if (girl.graceUntilDay !== undefined) {
      if (state.day >= girl.graceUntilDay) {
        if (pending) {
          pending.status = 'expired';
          pending.expiredBy = 'superseded';
        }
        leaveGirl(state, girl, pressure.reason);
      }
      continue;
    }
    // 正在出勤的人不当场走，等她回来再判。
    if (girl.status === 'mission' || girl.status === 'expedition') continue;
    if (pending) continue;
    state.incidents.unshift(resignIncident(state, girl, pressure.reason));
  }
}

/** 处理完这条弹窗之后的账：留人清账、放人走人、再想想给宽限。 */
export function applyResignationChoice(state: GameState, incident: Incident): void {
  if (!incident.girlId) return;
  const girl = state.girls.find(item => item.id === incident.girlId);
  if (!girl) return;
  const choice = incident.choiceId;
  if (choice === 'persuade') {
    girl.strain = { lowBondDays: 0, highFatigueDays: 0 };
    girl.graceUntilDay = undefined;
    return;
  }
  if (choice === 'release') {
    leaveGirl(state, girl, resignationPressure(girl)?.reason ?? girl.leftReason ?? 'bond');
    return;
  }
  if (choice === 'wait') girl.graceUntilDay = state.day + RESIGN_GRACE_DAYS;
}

/** 面板与名册用：还在册的人。 */
export function presentGirls(girls: Girl[]): Girl[] {
  return girls.filter(girl => !girl.left && !girl.dead);
}
