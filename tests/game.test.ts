import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, act, loadState, capacity, chance } from '../src/game.ts';

test('初始数据包含完整中文人物与地图任务', () => {
  const s = createInitialState();
  assert.equal(s.girls.length, 4); assert.ok(s.missions.length >= 5); assert.equal(capacity(s), 6);
  assert.ok(s.girls.every(g => g.name && g.skill && g.portrait));
});
test('派遣不修改原状态；角色变忙，任务激活', () => {
  const s = createInitialState(); const r = act(s, { type:'dispatch', girlId:'yue', missionId:'candy' });
  assert.equal(r.ok, true); assert.equal(s.girls[0].status, 'idle');
  assert.equal(r.state.girls[0].status, 'mission'); assert.equal(r.state.missions.find(m=>m.id==='candy')?.status, 'active');
});
test('重复派遣、低血量与过劳被阻止', () => {
  const s = createInitialState(); s.girls[0].fatigue = 85;
  assert.equal(act(s, {type:'dispatch', girlId:'yue',missionId:'candy'}).ok, false);
  s.girls[0].fatigue=10; s.girls[0].hp=10;
  assert.equal(act(s, {type:'dispatch',girlId:'yue',missionId:'candy'}).ok,false);
  s.girls[0].hp=100; const r=act(s,{type:'dispatch',girlId:'yue',missionId:'candy'});
  assert.equal(act(r.state,{type:'dispatch',girlId:'yue',missionId:'station'}).ok,false);
});
test('推进时间完成任务，结算收入、疲劳与日志且只结算一次', () => {
  const s=createInitialState(); const r=act(s,{type:'dispatch',girlId:'yue',missionId:'candy'});
  const done=act(r.state,{type:'advance',minutes:120});
  assert.equal(done.state.girls[0].status,'idle'); assert.ok(done.state.gold>s.gold);
  assert.ok(done.state.completed.includes('candy')); const gold=done.state.gold;
  assert.equal(act(done.state,{type:'advance',minutes:15}).state.gold,gold);
});
test('治疗消耗费用与时间，休息恢复疲劳', () => {
  const s=createInitialState(); s.girls[0].hp=30;
  const h=act(s,{type:'care',girlId:'yue',mode:'healing'});
  assert.equal(h.ok,true); assert.equal(h.state.gold,s.gold-180);
  assert.equal(act(h.state,{type:'advance',minutes:60}).state.girls[0].hp,100);
  s.girls[0].fatigue=75;
  const rest=act(s,{type:'care',girlId:'yue',mode:'resting'});
  assert.equal(act(rest.state,{type:'advance',minutes:90}).state.girls[0].fatigue,5);
  s.gold=0; assert.equal(act(s,{type:'care',girlId:'yue',mode:'healing'}).ok,false);
});
test('雇佣扣款、去重并遵守基地容量', () => {
  const s=createInitialState(); s.gold=20000;
  const r=act(s,{type:'hire',girlId:'zhi'}); assert.equal(r.ok,true); assert.equal(r.state.girls.length,5);
  assert.equal(act(r.state,{type:'hire',girlId:'zhi'}).ok,false);
  r.state.rooms.find(r=>r.type==='dorm')!.capacity=5;
  assert.equal(act(r.state,{type:'hire',girlId:'lu'}).ok,false);
});
test('资金不足不建造，成功扩建后容量增加', () => {
  const s=createInitialState(); const n=capacity(s); s.gold=0;
  assert.equal(act(s,{type:'build'}).ok,false); s.gold=5000;
  const r=act(s,{type:'build'}); assert.equal(r.ok,true); assert.equal(capacity(r.state),n+2);
});
test('本地剧情拒绝空输入，保存玩家与角色消息并限制长度', () => {
  const s=createInitialState(); assert.equal(act(s,{type:'talk',girlId:'yue',text:'  '}).ok,false);
  const r=act(s,{type:'talk',girlId:'yue',text:'你今天还好吗？'});
  assert.equal(r.ok,true); assert.equal(r.state.messages.yue.at(-2)?.role,'player');
  assert.equal(r.state.messages.yue.at(-1)?.role,'girl'); assert.ok(r.state.girls[0].bond>s.girls[0].bond);
});
test('跨日推进记录新日期，拒绝负数及过大推进量', () => {
  const s=createInitialState(); s.minutes=23*60+45;
  const r=act(s,{type:'advance',minutes:30}); assert.equal(r.state.day,s.day+1); assert.equal(r.state.minutes,15);
  assert.equal(act(s,{type:'advance',minutes:-5}).ok,false);
  assert.equal(act(s,{type:'advance',minutes:NaN}).ok,false);
});
test('跨午夜推进按委托实际完成时刻记录收入与日志', () => {
  const initial=createInitialState(); initial.minutes=23*60+10;
  const dispatched=act(initial,{type:'dispatch',girlId:'yue',missionId:'candy'}).state;
  const result=act(dispatched,{type:'advance',minutes:60}).state;
  assert.equal(result.day,15); assert.equal(result.minutes,10);
  assert.equal(result.samples.find(x=>x.day===14)!.income,initial.samples.at(-1)!.income+680);
  assert.equal(result.samples.find(x=>x.day===15)!.income,0);
  assert.equal(result.logs.find(l=>l.delta===680)!.time,'第 14 日 · 23:55');
});
test('坏存档安全回退，合法存档能恢复，异常嵌套数据拒绝', () => {
  assert.equal(loadState('not json').girls.length,4);
  assert.equal(loadState('{"version":1}').girls.length,4);
  const s=createInitialState(); s.gold=999; assert.equal(loadState(JSON.stringify(s)).gold,999);
  const malformed=structuredClone(s); malformed.girls[0].stats=null as never;
  assert.equal(loadState(JSON.stringify(malformed)).gold,12840);
});
test('存档拒绝孤立的派遣委托与危险角色标识', () => {
  const orphan=createInitialState(); orphan.gold=456; orphan.missions[0].status='active';
  assert.equal(loadState(JSON.stringify(orphan)).gold,12840);
  const mismatched=createInitialState(); mismatched.gold=456; mismatched.missions[0].status='active'; mismatched.missions[0].girlId='yue';
  assert.equal(loadState(JSON.stringify(mismatched)).gold,12840);
  const dangerous=createInitialState(); dangerous.gold=456; dangerous.girls[0].id='constructor';
  assert.equal(loadState(JSON.stringify(dangerous)).gold,12840);
  const active=act(createInitialState(),{type:'dispatch',girlId:'yue',missionId:'candy'}).state; active.gold=456;
  assert.equal(loadState(JSON.stringify(active)).gold,456);
});
test('小于一分钟的推进不产生无意义成功结果', () => {
  assert.equal(act(createInitialState(),{type:'advance',minutes:.5}).ok,false);
});
test('雾眠保留专属猫咪对白，日羁绊增长有上限', () => {
  let s=createInitialState(); const initial=s.girls.find(g=>g.id==='wu')!.bond;
  for(let i=0;i<6;i++)s=act(s,{type:'talk',girlId:'wu',text:'辛苦了'}).state;
  assert.match(s.messages.wu.at(-1)!.text,/帽子里的猫/);
  assert.equal(s.girls.find(g=>g.id==='wu')!.bond,initial+6);
});
test('匹配率保持 35 到 99 之间且随能力增加', () => {
  const s=createInitialState(); const g=s.girls[0],m=s.missions[0];
  const low=chance(g,m); g.stats[m.requirement]=100;
  assert.ok(chance(g,m)>=low); assert.ok(chance(g,m)<=99); assert.ok(low>=35);
});
