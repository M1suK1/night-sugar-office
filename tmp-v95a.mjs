import { readFileSync, writeFileSync } from 'node:fs';
const read = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => writeFileSync(f, s);

// 1) 上限 20 → 30
let op = read('src/opening.ts');
op = op.replace(
  `/** 开局从卡库摆出来的选人池上限（没被选中的留在市场）。 */
export const OPENING_CARDS = 20;`,
  `/** 开局从卡库摆出来的选人池上限（没被选中的留在市场）。 */
export const OPENING_CARDS = 30;`,
);
op = op.replace(
  ` * 一张带 1024 立绘的卡约 2–3MB，20 张就是 40–60MB：这些立绘会跟着 \`GameState\``,
  ` * 一张带 1024 立绘的卡约 2–3MB，30 张就是 60–90MB——但 v92 之后立绘落盘时会被搬进资产库、`,
);
op = op.replace(
  ` * 一起被 JSON 序列化进存档，低配机器上开局就顶不住。超过预算的卡留在卡库里，`,
  ` * 只留引用，所以内存压力主要来自开局那一次读卡。超过预算的卡留在卡库里，`,
);
write('src/opening.ts', op);

// 2) 注释与文案里的 20 换成 OPENING_CARDS
let sd = read('src/components/StarterDialog.tsx');
sd = sd.replaceAll('卡库够 20 张', '卡库够 OPENING_CARDS 张');
sd = sd.replaceAll('卡够 20 张时', '卡够 OPENING_CARDS 张时');
sd = sd.replaceAll('卡库还不够 20 张', '卡库还不够 ${OPENING_CARDS} 张');
write('src/components/StarterDialog.tsx', sd);

let ro = read('src/roster.ts');
ro = ro.replaceAll('卡库够 20 张', '卡库够 OPENING_CARDS 张');
ro = ro.replaceAll('卡不够 20 张', '卡不够 OPENING_CARDS 张');
ro = ro.replaceAll('卡够 20 张时', '卡够 OPENING_CARDS 张时');
write('src/roster.ts', ro);

let cm = read('src/cardMarket.ts');
cm = cm.replaceAll('摆满 20 个人', '摆满 OPENING_CARDS 个人');
cm = cm.replaceAll('20 张开局后', '开局摆满之后');
write('src/cardMarket.ts', cm);

let app = read('src/App.tsx');
app = app.replaceAll('卡库里能用的卡数：够 20 张时', '卡库里能用的卡数：够 OPENING_CARDS 张时');
app = app.replaceAll('卡库摆出最多 20 张选人池', '卡库摆出最多 OPENING_CARDS 张选人池');
write('src/App.tsx', app);
console.log('limits updated');
