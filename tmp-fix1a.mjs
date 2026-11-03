import { readFileSync, writeFileSync } from 'node:fs';
const read = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const write = (f, s) => writeFileSync(f, s);

// ---------- 1. incidents.ts：谁该主动弹出来
let inc = read('src/incidents.ts');
if (!inc.includes('openIncidentFor')) {
  inc += `
/**
 * 该主动弹出来的那一条：先看必须立刻决定的，再看还没被「稍后再说」推迟的。
 *
 * 以前只有 blocking 的会自己弹（App 里判断 blockingIncidents），于是叙事者拟的
 * 非阻塞事件全都沉在任务列表里，玩家不点就永远看不到——事件白生成了。
 */
export function openIncidentFor(state: GameState, deferred: readonly string[] = []): Incident | undefined {
  const blocking = blockingIncidents(state);
  if (blocking.length) return blocking[0];
  return pendingIncidents(state).find(incident => !deferred.includes(incident.id));
}
`;
  write('src/incidents.ts', inc);
}
console.log('incidents helper:', inc.includes('openIncidentFor'));

// ---------- 2. App：用它来决定弹窗 + 记住「稍后再说」
let app = read('src/App.tsx');
if (!app.includes('openIncidentFor')) {
  app = app.replace(
    `  const pendingIncident = blockingPending[0]`,
    `  const pendingIncident = openIncidentFor(state, deferredIncidents) ?? blockingPending[0]`,
  );
  // 原来那行是多行表达式，先看看替换后有没有残留
  app = app.replace(
    `import { blockingIncidents } from './incidents';`,
    `import { blockingIncidents, openIncidentFor } from './incidents';`,
  );
  if (!app.includes('deferredIncidents')) throw new Error('pendingIncident replaced, need deferred state');
  write('src/App.tsx', app);
}
console.log('app wired:', app.includes('openIncidentFor'));
