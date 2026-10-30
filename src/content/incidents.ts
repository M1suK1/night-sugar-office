/**
 * 内置弹窗事件模板。
 *
 * 文案里的 `{district}` `{girl}` `{faction}` `{envoy}` 由引擎在投放时换成这一局的名字
 * （见 `src/incidents.ts` 的 `fillIncidentText`）。因此这里**不写** `district` / `girlId`：
 * 模板不知道这一局谁是辖区当主、哪一位少女熬夜，交给引擎决定。
 *
 * 数值口径：gold 是绝对增减量；reputation 一次 ±1–2；faction.standing ±2–4；
 * 少女的 fatigue / spirit / bond / corruption ±2–8。没有一条会把人打崩。
 */
import type { IncidentTemplate } from '../types.ts';

/** 平时轮换用的内置事件。冷却缺省 7 天，存活缺省 240 分钟。 */
export const builtinIncidents: IncidentTemplate[] = [
  {
    id: 'news-sugar-tax',
    category: 'report',
    trigger: { kind: 'dayStart' },
    title: '夜巡税',
    kind: 'faction',
    body: '市役所在街口贴了新告示：夜间巡逻按辖区面积计税，事务所那一份直接摊进下次结算。{faction}的窗口只回了一句——这笔钱最后会变成谁的路灯。',
    cooldownDays: 7,
    options: [],
  },
  {
    id: 'news-clinic-queue',
    category: 'report',
    trigger: {
      kind: 'condition',
      all: [
        { field: 'fatigue', op: '>=', value: 60 },
        { field: 'girlCount', op: '>=', value: 2 },
      ],
    },
    title: '诊所排到了巷口',
    kind: 'girl',
    body: '月光诊所门口的塑料椅一路排到巷口，护士叫到号的人大多在打瞌睡。队伍里有一半是我们这行的人。没有人说话，大家都知道这是损耗，不是感冒。',
    cooldownDays: 7,
    options: [],
  },
  {
    id: 'faction-ultimatum',
    category: 'decision',
    trigger: { kind: 'condition', all: [{ field: 'faction', op: '<', value: 35, faction: 'association' }] },
    title: '摊在桌上的两份文件',
    kind: 'faction',
    body: '{faction}的代表{envoy}把两份文件并排摊开：一份要契约者名单，一份要在辖区边界上签一笔。他说他们不会等太久，也不会来第二次。',
    ttlMinutes: 360,
    cooldownDays: 7,
    options: [
      {
        id: 'comply',
        label: '名单可以给',
        hint: '辖区留得住，名册上的人心里会记着',
        effect: { reputation: -2, faction: { id: 'association', standing: 3 } },
      },
      {
        id: 'stall',
        label: '拖到下个月',
        hint: '先垫星砂和夜班费，把人挡回去',
        effect: { gold: -300, faction: { id: 'association', standing: -2 } },
      },
    ],
  },
  {
    id: 'faction-patrol',
    category: 'report',
    trigger: { kind: 'wave', wave: 1 },
    title: '巡夜队从门口过',
    kind: 'faction',
    body: '{faction}的巡夜队今晚绕到这条街，脚步很齐，灯举得很高。领队在我们门口停了两秒，说了一句“你们的灯比规定的亮”，然后就走了。',
    cooldownDays: 7,
    options: [],
  },
  {
    id: 'battle-aftermath',
    category: 'report',
    trigger: { kind: 'missionDone', work: 'combat' },
    title: '街上的后续',
    kind: 'environment',
    body: '回来的路上有人把热的东西塞进我们手里。{district}的人说，昨晚那一声之后，窗帘后面终于有人敢开灯了。他们不记得事务所的名字，只记得灯是什么颜色。',
    cooldownDays: 7,
    options: [
      { id: 'note', label: '记进值夜簿', hint: '这条街今晚会安静一点', effect: { reputation: 1 } },
    ],
  },
  {
    id: 'girl-insomnia',
    category: 'scene',
    trigger: { kind: 'condition', all: [{ field: 'fatigue', op: '>=', value: 80 }] },
    title: '厨房只开了一盏灯',
    kind: 'girl',
    body: '{girl}坐在餐桌前，杯子里的糖水已经凉了。人没睡，也没打算睡。',
    ttlMinutes: 180,
    cooldownDays: 7,
    scene: {
      title: '没睡着的那一个',
      narration: '灶台上还留着上一班的锅。她听见脚步声，没有回头，只把杯子往旁边挪了挪，空出半张桌面。',
      lines: [
        { speaker: '少女', tone: '平静', text: '眼睛一闭，就能听见那边的声音。' },
        { speaker: '少女', tone: '低声', text: '不是害怕。就是关不掉。' },
        { speaker: '少女', tone: '犹豫', text: '你也不用管我。坐着就行。' },
      ],
    },
    options: [
      {
        id: 'sit',
        label: '陪她坐一会',
        hint: '不开灯，也不说话',
        effect: { girl: { spirit: 6, bond: 4, corruption: -2 } },
      },
      {
        id: 'send-back',
        label: '让她回去躺着',
        hint: '明天还有一班',
        effect: { girl: { fatigue: -6, spirit: -2, bond: -2 } },
      },
    ],
  },
  {
    id: 'girl-letter',
    category: 'scene',
    trigger: { kind: 'dayStart' },
    title: '桌上压着一张糖纸',
    kind: 'girl',
    body: '{girl}的字写在糖纸背面，压在我们的排班表下面。读到第二行的时候，她本人从门口探进来，看见那张纸还捏在我们手里，就没有退回去。',
    cooldownDays: 7,
    scene: {
      title: '信读到一半',
      narration: '纸是从笔记本上撕下来的，边缘不齐。字迹到一半开始变轻，像写的人自己也不确定要不要写完。',
      lines: [
        { speaker: '少女', tone: '平静', text: '不用读完。我在这儿，可以直接说。' },
        { speaker: '少女', tone: '低声', text: '我算过了，契约下个月到期。' },
        { speaker: '少女', tone: '犹豫', text: '如果那时候我还在，你们会续吗。' },
      ],
    },
    options: [
      {
        id: 'sign',
        label: '当场把名字写上去',
        hint: '续约，不谈条件',
        effect: { gold: -400, girl: { bond: 6, spirit: 4 } },
      },
      {
        id: 'keep-letter',
        label: '让她先把纸收着',
        hint: '这件事该在桌上谈',
        effect: { girl: { bond: -2, spirit: -2 } },
      },
    ],
  },
  {
    id: 'env-fog',
    category: 'decision',
    trigger: { kind: 'wave', wave: 2 },
    title: '雾贴着地面走',
    kind: 'environment',
    body: '雾从{district}那头渗进来，比人走得快，路灯开始一盏一盏只亮半边。现在烧储备星砂还来得及铺一道边；不烧，就只能看它走到哪里。',
    cooldownDays: 7,
    options: [
      {
        id: 'burn',
        label: '烧星砂铺边',
        hint: '今晚的灯撑到天亮',
        effect: { gold: -600, reputation: 1 },
      },
      {
        id: 'hold',
        label: '先不动储备',
        hint: '雾会散，也可能不会',
        effect: { reputation: -1, faction: { id: 'government', standing: 2 } },
      },
    ],
  },
  {
    id: 'env-blackout',
    category: 'decision',
    trigger: { kind: 'condition', all: [{ field: 'pollution', op: '>=', value: 50 }] },
    title: '供灯线路跳了闸',
    kind: 'environment',
    body: '{district}的变压器跳了闸。供电所说这条线本来就不该供这么远。现在动储备还能把灯接回去；不动，今晚就得摸黑过。',
    cooldownDays: 7,
    options: [
      {
        id: 'restore',
        label: '接回去',
        hint: '灯亮着，街上就还有人',
        effect: { gold: -450, reputation: 2 },
      },
      {
        id: 'dark',
        label: '熄灯硬扛',
        hint: '省下这一笔，也让街空下来',
        effect: { reputation: -2, faction: { id: 'witch', standing: 2 } },
      },
    ],
  },
  {
    id: 'market-rumor',
    category: 'report',
    trigger: { kind: 'dayStart' },
    title: '有人在夜市打听我们',
    kind: 'faction',
    body: '问到第三家摊子，我们才听说有人在打听事务所：不问价钱，只问收了几个、留得住几个。那人走之前，把一个还没签约的名字留在了纸袋上。',
    cooldownDays: 7,
    options: [],
  },
];

/**
 * 战争预兆：两个势力开始争同一片辖区时的三条通报。
 * priority 10 让它们在池子里优先投放，冷却压到 3 天，好让摩擦期反复出现。
 */
export const warSignalTemplates: IncidentTemplate[] = [
  {
    id: 'war-signal-street',
    category: 'report',
    trigger: { kind: 'dayStart' },
    title: '两拨人堵在路灯下',
    kind: 'faction',
    body: '{faction}的人占了半边人行道，另一边站着另一拨，谁也没有先开口。路灯被砸掉一块，玻璃扫进了排水口。到了交班时间，两拨人都没走。{district}今晚会有两遍巡街。',
    priority: 10,
    cooldownDays: 3,
    options: [],
  },
  {
    id: 'war-signal-patrol',
    category: 'report',
    trigger: { kind: 'dayStart' },
    title: '巡夜队换了班次',
    kind: 'faction',
    body: '{faction}把巡夜队调了班，交接只对了一次表。{district}这一晚被两方各走一遍：第二遍的人拔掉第一遍插的标记，插到了马路对面。',
    priority: 10,
    cooldownDays: 3,
    options: [],
  },
  {
    id: 'war-signal-hoard',
    category: 'report',
    trigger: { kind: 'condition', all: [{ field: 'pollution', op: '>=', value: 40 }] },
    title: '有人开始囤灯油',
    kind: 'environment',
    body: '{district}的杂货铺把灯油挪到了货架后面，糖按整箱出，说是有主顾在收。问到是谁，掌柜只提了一句：{faction}的人前几天来过，付的现钱。',
    priority: 10,
    cooldownDays: 3,
    options: [],
  },
];

/** 两个数组按 id 合并成的索引，投放与校验按 id 直接查。 */
export const incidentTemplateById: Record<string, IncidentTemplate> = [
  ...builtinIncidents,
  ...warSignalTemplates,
].reduce<Record<string, IncidentTemplate>>((map, template) => {
  map[template.id] = template;
  return map;
}, {});
