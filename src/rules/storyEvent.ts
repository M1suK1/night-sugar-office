import { districtAt, districts } from '../districts.ts';
import type { CharacterEvent, GameState, Girl, StoryPassage, Storyline } from '../types.ts';
import { archive, dateLabel, findGirl, hashText } from './core.ts';
import { resolveStoryWait, spawnStoryBeat, storyChoices } from './storyRun.ts';
// v35 从 src/game.ts 拆出：角色事件、分幕剧情与交互剧情会话。

/** 交互剧情最多走几轮玩家行动；到上限后只允许结束事件。 */
export const STORY_SESSION_TURNS = 12;

// ---------------------------------------------------------------- 故事线
export const storyBeats = [
  { title: '第一幕 · 未寄出的信', scene: '她把一封信放在桌上，没有推向你，也没有收回去。', hook: '信纸边缘有一道被反复折过的痕。' },
  { title: '第二幕 · 旧名字', scene: '旧城区的路灯下，她念出一个名字，然后立刻否认自己认识这个人。', hook: '那个名字写在辖区的旧档案里。' },
  { title: '第三幕 · 雨里的选择', scene: '雨把整条糖果街洗得发亮。她站在街口，等你先说要去哪。', hook: '她今晚没有带伞。' },
  { title: '第四幕 · 回到会客厅', scene: '回到会客厅时已经快打烊了。她坐在那把多出来的椅子上，第一次没有先开口。', hook: '桌上放着两杯还温着的茶。' },
];

/** 剧情事件结束：推进到下一幕，并发出下一份委托。 */
export function finishStoryEvent(state: GameState, event: CharacterEvent): void {
  if (!event.storylineId) return;
  const story = state.storylines.find(item => item.id === event.storylineId && item.status === 'active');
  if (!story) return;
  if (story.run) { resolveStoryWait(state, story.id, 'event', event.id); return; }
  const beat = story.beats.find(item => item.eventId === event.id);
  const girl = findGirl(state, story.girlId);
  if (!beat) return;
  story.stage = Math.max(story.stage, beat.index + 1);
  if (girl) girl.bond = Math.min(100, girl.bond + 5);
  if (story.stage >= story.beats.length) {
    story.status = 'done';
    if (girl) archive(state, '关系', `${story.title}（完）`, `${girl.name}的故事走到最后一幕，选择由你做出。`);
    state.logs.unshift({ id: `log-story-fin-${story.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `「${story.title}」讲完了。` });
    return;
  }
  spawnStoryBeat(state, story);
  state.logs.unshift({ id: `log-story-next-${story.id}-${story.stage}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `「${story.title}」进入${story.beats[story.stage].title}。` });
}

/** 不依赖 LLM 也能走完的模板故事线；LLM 可用时由 App 换成生成版。 */

/** 不依赖 LLM 也能走完的模板故事线；LLM 可用时由 App 换成生成版。 */
export function buildTemplateStoryline(state: GameState, girl: Girl, direction = ''): Storyline {
  const tone = direction.trim() || ['旧事', '契约', '城市传说'][hashText(`${girl.id}:${state.day}`) % 3];
  return {
    id: `story-${girl.id}-${state.day}-${state.minutes}`,
    girlId: girl.id,
    title: `${girl.name}的${tone}`,
    premise: `${girl.name}有一件一直没说的事。它和${districts[districtAt(30 + (hashText(girl.id) % 40), 40)].name}有关，也可能和你有关。`,
    tone,
    beats: storyBeats.map((beat, index) => {
      const beatDistrict = districtAt(20 + ((hashText(girl.id) + index * 17) % 58), 25 + ((hashText(beat.title) + index * 11) % 50));
      return {
        id: `beat-${index + 1}`,
        index,
        title: beat.title,
        summary: '',
        scene: beat.scene,
        hook: beat.hook,
        choices: storyChoices(index, girl),
        mission: {
          title: beat.title.replace(/^第.幕 · /, ''),
          goal: `完成「${beat.title.replace(/^第.幕 · /, '')}」：${beat.hook}`,
          category: '故事委托',
          difficulty: ['简单', '常规', '棘手', '危险'][index] ?? '常规',
          duration: 90,
          district: beatDistrict,
        },
        status: index === 0 ? 'open' : 'locked',
      };
    }),
    stage: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    day: state.day,
    source: 'template',
  };
}

/** 故事线效果落地：资源、羁绊、侵蚀、特性，以及它触发的其他内容。 */

/** 故事线的高潮会向事务所抛出真实的内容：委托、议题、事件、对话或辖区变动。 */

// ---------------------------------------------------------------- 角色事件

/** 无 Key 时的兜底剧情：四幕、每幕两百多字，选项只给轻度数值变化。 */

/** 无 Key 时的兜底剧情：四幕、每幕两百多字，选项只给轻度数值变化。 */
export function buildTemplateArc(girl: Girl, premise: string, hook: string): StoryPassage[] {
  const name = girl.name;
  return [
    {
      id: 'p1', title: '第一幕 · 等到灯灭',
      narration: `夜班的钟走到一半，${name}才出现在门口。她没有敲门，只是站在那里，手指在袖口里反复摩挲着什么。会客厅的灯把她影子拉得很长，一直铺到你脚边。${hook ? `${hook.replace(/[。！？]$/, '')}。` : ''}窗外有人在关店，卷帘门落下的声音一层层传上来，像某种提醒：再不说，就天亮了。她抬眼看你，又很快移开，像在确认你有没有在看她。你忽然想起她今天本该休息，委托表上那一行被她自己划掉了，理由只写了三个字：想走走。她没说要去哪里，也没有带你。现在她站在这里，鞋底还沾着外面的雨。你侧过身，把门口的位置让出来，又觉得这个动作太像在等她解释，于是只是把门推得更开了一点。`,
      lines: [
        { speaker: name, tone: '轻声', text: '我是不是来得不是时候。' },
        { speaker: '你', tone: '', text: '你来了就是时候。' },
      ],
      choices: [
        { id: 'p1-a', label: '把椅子往她那边挪一点', intent: '让她知道你想听', effect: { bond: 3 } },
        { id: 'p1-b', label: '先不催她，去倒一杯热水', intent: '把节奏交给她', effect: { bond: 2, corruption: -1 } },
      ],
    },
    {
      id: 'p2', title: '第二幕 · 那件旧事',
      narration: `水汽在杯口散开，她终于开口，说的却是与今晚无关的旧事。${premise ? `「${premise.replace(/[。！？]$/, '')}」这件事，她一直没跟任何人讲完。` : '她讲起刚签下契约的那几个月，说自己那时候连影子都不敢照镜子。'}说到这里她停住，指腹在杯壁上按出一个小小的印子，像是在衡量你会不会笑她。你没有接话，房间里只剩下呼吸和远处的车声。她忽然补了一句：其实我不怕你笑，我怕你记不住。你问她那句话是什么意思，她想了想，说记不住也没关系，反正她自己也快记不清了。说完她低头笑了一下，笑意没有到眼睛里。窗外有车经过，灯光扫过她的侧脸，又退回去，房间里重新只剩下那盏没关的台灯。`,
      lines: [
        { speaker: name, tone: '停顿', text: '……你是不是觉得我很奇怪。' },
        { speaker: '你', tone: '', text: '我在听。' },
      ],
      choices: [
        { id: 'p2-a', label: '问她后来是怎么撑过来的', intent: '让她把故事讲完', effect: { bond: 3, corruption: 1 } },
        { id: 'p2-b', label: '告诉她，你记得她第一次出任务的样子', intent: '把记忆还给她', effect: { bond: 4 } },
      ],
    },
    {
      id: 'p3', title: '第三幕 · 没说出口的',
      narration: `${name}把杯子放回桌面，动作轻得像怕惊动什么。她说起今晚那件事的结尾，声音比刚才低，句子也开始不完整。你听得出她在绕开某个名字、某段路、某一次没能救下的结果。窗外开始起雾，玻璃上凝出一层白，把城市揉得模糊。她抬手在雾上画了一道，又立刻擦掉，像在替自己收回一句不该说的话。你忽然明白，她不是在求你替她解决什么，她只是想有一个人知道，那一晚她其实也害怕。你没有催她，只把灯调暗了一点。她顺着这个动作继续说，说到某个名字时停了两秒，然后换了个说法绕过去。你知道那里有一道她还没准备好的口子，就没有去碰。她也没有再解释，只是把杯子往你这边推了推，像是把话题也一起推过来。`,
      lines: [
        { speaker: name, tone: '低声', text: '你会不会觉得，我不该怕。' },
        { speaker: '你', tone: '', text: '会怕，才说明你在乎。' },
      ],
      choices: [
        { id: 'p3-a', label: '承认你也怕过', intent: '与她站在同一边', effect: { bond: 4, corruption: -1 } },
        { id: 'p3-b', label: '把她的手从杯子上拿开', intent: '先让她停下来', effect: { bond: 3, corruption: 1 } },
      ],
    },
    {
      id: 'p4', title: '第四幕 · 天亮之前',
      narration: `${name}站起身，走到窗边，把雾擦出一小块清楚的地方。她说，那就这样吧，明天还有委托。语气恢复成平时的样子，好像刚才那一小时没有发生过。但她没有立刻走，而是回头看了你一眼，把一样东西留在桌上——不是信，也不是礼物，只是一张写着字的便签：下次别让我一个人说这么久。门合上之后，走廊的灯还亮着，你听见她的脚步在楼梯拐角停了一下，才继续往下。会客厅重新安静下来，杯子里剩的水已经凉透了。你坐了一会儿，才想起明天还有一整个夜班的委托要排。把便签收好之后，你在值班表上她那一栏多画了一个圈，提醒自己别再把她的名字排在最后一个。走廊尽头传来电梯到站的声音，又安静下去，像这一晚终于肯放过你。`,
      lines: [
        { speaker: name, tone: '回头', text: '晚安。明天见。' },
        { speaker: '你', tone: '', text: '明天见。' },
      ],
      choices: [
        { id: 'p4-a', label: '把那张便签收进抽屉', intent: '记住这一晚', effect: { bond: 4, corruption: -2 } },
        { id: 'p4-b', label: '追出去，送她到街口', intent: '不让这一晚就到这里', effect: { bond: 5, corruption: 1 } },
      ],
    },
  ];
}
