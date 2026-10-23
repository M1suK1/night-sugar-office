import type { ActionResult, GameAction, GameState, Girl, Mission, StatKey, Log } from './types.ts';
export const SAVE_KEY = 'night-sugar-office:v1';
export const statLabels: Record<StatKey, string> = { magic:'魔力', insight:'洞察', agility:'敏捷', empathy:'共情' };
export const statusLabels = { idle:'待命', mission:'派遣中', healing:'治疗中', resting:'休息中' };
export const clock = (minutes: number) => `${Math.floor(minutes / 60).toString().padStart(2,'0')}:${(minutes % 60).toString().padStart(2,'0')}`;
export const capacity = (s: GameState) => s.rooms.filter(r=>r.type==='dorm').reduce((n,r)=>n+r.capacity,0);
export const buildCost = (s: GameState, id = 'dorm') => 2400 * (s.rooms.find(r=>r.id===id)?.level ?? 1);
export const chance = (g: Girl, m: Mission) => Math.max(35, Math.min(99, Math.round(70 + (g.stats[m.requirement]-m.target)*.65 - g.fatigue*.15)));

const girl = (data: Partial<Girl> & Pick<Girl,'id'|'name'|'codename'|'element'|'color'|'stats'|'skill'|'description'>): Girl => ({
  title:'正式契约', portrait:`/art/${data.id}.svg`, level:4, hp:100, maxHp:100, fatigue:15, bond:32,
  status:'idle',roomId:'lounge',remaining:0,cost:0,...data,
});
export function createInitialState(): GameState {
  const girls: Girl[] = [
    girl({id:'yue',name:'月见桃',codename:'绯色回响',element:'星光系',color:'#f49abd',level:6,stats:{magic:88,insight:65,agility:82,empathy:92},skill:'桃色结界',description:'把城市里没能说出口的心愿，叠成粉色的星星。她是夜糖事务所最早的契约者，也是总忘记带伞的人。',fatigue:24,bond:68}),
    girl({id:'tang',name:'砂糖',codename:'白夜糖霜',element:'治愈系',color:'#decfae',level:5,hp:88,stats:{magic:72,insight:82,agility:56,empathy:96},skill:'晚安糖果',description:'习惯在出发前，往每个人口袋里塞一颗糖。温柔不是她的弱点，而是她选择守护这座城的方式。',fatigue:38,bond:54,roomId:'clinic'}),
    girl({id:'ling',name:'零青',codename:'静默频率',element:'月影系',color:'#9cc9d2',hp:62,level:5,stats:{magic:79,insight:96,agility:91,empathy:48},skill:'月相解码',description:'能听见被城市噪声掩盖的微小信号。总是独来独往，却会把每一位同伴的回程时间记在心里。',fatigue:52,bond:28,roomId:'observatory'}),
    girl({id:'wu',name:'雾眠',codename:'梦境收集者',element:'梦境系',color:'#b8a9d2',level:3,stats:{magic:90,insight:85,agility:42,empathy:76},skill:'绵羊星云',description:'在别人的噩梦里种花，醒来时把花带回枕边。她的帽子下面，偶尔会传来一只猫的呼噜声。',fatigue:66,bond:41,status:'resting',remaining:30,roomId:'dorm'}),
  ];
  const missions: Mission[] = [
    {id:'candy',title:'糖果街的失眠电波',category:'异象调查',description:'午夜以后，糖果街的自动售货机会播放不存在的摇篮曲。附近的孩子连续三晚做了同一个梦。请找到电波源，并让街区恢复安眠。',x:24,y:27,difficulty:'普通',duration:45,reward:680,requirement:'empathy',target:68,color:'#f49abd',status:'open'},
    {id:'station',title:'末班车上的第十三人',category:'紧急委托',description:'月台监控多出了一个没有影子的乘客。末班车即将离站，请在列车驶入隧道前，确认她究竟想去哪里。',x:66,y:25,difficulty:'困难',duration:60,reward:920,requirement:'insight',target:84,color:'#d4b7f2',status:'open'},
    {id:'mirror',title:'镜中的另一轮月亮',category:'结界修复',description:'月见广场的喷泉倒映出两轮月亮。倒影正在缓慢吞噬现实的边界，需要擅长魔力控制的契约者修复结界。',x:42,y:51,difficulty:'困难',duration:90,reward:1240,requirement:'magic',target:86,color:'#9cc9d2',status:'open'},
    {id:'cat',title:'寻找走失的星尾猫',category:'市民求助',description:'星尾猫带着一颗刚刚许下的愿望跑进了河岸公园。请在愿望消散之前找到它。它喜欢鱼干，但更喜欢被认真叫出名字。',x:76,y:62,difficulty:'简单',duration:30,reward:420,requirement:'agility',target:55,color:'#decfae',status:'open'},
    {id:'tower',title:'旧钟楼的未寄信',category:'心愿回收',description:'一封寄给十年前的信，每晚都会出现在旧钟楼的信箱里。我们需要一位愿意倾听的魔法少女，陪写信的人把故事说完。',x:27,y:76,difficulty:'普通',duration:60,reward:760,requirement:'empathy',target:76,color:'#f49abd',status:'open'},
  ];
  return {
    version:1,day:14,minutes:21*60+40,gold:12840,reputation:76,girls,missions,
    candidates:[
      girl({id:'zhi',name:'栀子',codename:'春日药笺',title:'待签约',element:'自然系',color:'#b6cba3',level:4,stats:{magic:74,insight:68,agility:62,empathy:90},skill:'花间处方',cost:2400,description:'在城市的缝隙里种草药。她相信每一种伤口，都有适合它的春天。擅长治疗与长时间支援。',bond:0}),
      girl({id:'lu',name:'鹿铃',codename:'赤焰节拍',title:'待签约',element:'赤焰系',color:'#e6a6a7',level:6,stats:{magic:94,insight:58,agility:93,empathy:66},skill:'终幕焰火',cost:3200,description:'地下乐队的鼓手，夜晚街区的守护者。越是危急的时刻，她的心跳就越稳定。',bond:0}),
    ],
    rooms:[
      {id:'lounge',name:'星屑会客厅',type:'lounge',level:1,capacity:4,description:'热可可永远温着。可以在这里和待命的契约者聊聊她们的心事。'},
      {id:'clinic',name:'月光医务室',type:'clinic',level:1,capacity:1,description:'以月光和糖霜修复伤口。每次治疗费用 180 星砂，耗时 60 分钟。'},
      {id:'dorm',name:'晚安宿舍',type:'dorm',level:1,capacity:6,description:'每人都有一盏小夜灯。休息 90 分钟恢复 70 点疲劳，扩建可增加契约容量。'},
      {id:'observatory',name:'屋顶观星台',type:'observatory',level:1,capacity:2,description:'天线捕捉城市的心愿。升级后会获得更好的观测空间；当前原型不影响任务数值。'},
    ],
    logs:[
      {id:'initial-1',time:'第 14 日 · 21:35',kind:'story',text:'零青带回一段未知频率：「今晚的月亮，好像有些不一样。」'},
      {id:'initial-2',time:'第 14 日 · 21:20',kind:'care',text:'雾眠回到晚安宿舍休息，预计 22:10 完成。'},
      {id:'initial-3',time:'第 14 日 · 20:50',kind:'finance',text:'结算「雨夜便利店」委托报酬。',delta:860},
      {id:'initial-4',time:'第 14 日 · 20:05',kind:'dispatch',text:'月见桃完成巡逻，糖果街区的异常信号已标记。'},
    ],
    samples:Array.from({length:14},(_,i)=>({day:i+1,income:[1360,1720,1480,2100,1840,2460,2120,2680,2380,3100,2860,3420,3240,3680][i],expense:[480,620,540,720,650,820,700,940,860,1080,980,1160,1020,1240][i],reputation:Math.round(36+i*3.1)})),
    completed:[],messages:{},
  };
}
function log(s:GameState,kind:Log['kind'],text:string,delta?:number) {
  s.logs.unshift({id:crypto.randomUUID(),time:`第 ${s.day} 日 · ${clock(s.minutes)}`,kind,text,delta});
  s.logs=s.logs.slice(0,300);
  if(delta) { const sample=s.samples.find(x=>x.day===s.day); if(sample) { if(delta>0) sample.income+=delta; else sample.expense-=delta; } }
}
function response(g:Girl,text:string,count:number):string {
  if (/累|休息|辛苦|晚安/.test(text)) return `${g.id==='wu'?'帽子里的猫轻轻打了个哈欠。':'她放下手中的东西，朝你露出一点笑意。'}「被你发现了……确实有一点累。等这次值班结束，可以陪我在会客厅坐一会儿吗？」`;
  if (/伤|治疗|疼|身体/.test(text)) return '「伤口已经不那么疼了。医务室的灯很温柔，但我更喜欢有人记得来问一句。」她把袖口轻轻拉好。「放心，我会好好照顾自己的。」';
  if (/月|信号|电波|异象/.test(text)) return '「我也注意到了。今晚的信号，不像求救……更像有人在找回一段记忆。」她看向窗外的月亮。「如果要去调查，让我和你一起，好吗？」';
  if (/糖|喜欢|礼物|可可/.test(text)) return '「比起甜味，我更喜欢有人把糖放进我手心的那一刻。」她笑着收好那颗糖。「下次换我来准备。你喜欢什么口味？」';
  const replies=[
    `「嗯，我在听。」${g.name}把视线从窗外收回来。「在这里，我不需要一直表现得很勇敢，对吧？」`,
    '「我还记得第一次来到事务所的那个夜晚。那时也下着雨，可门口的灯一直亮着。」她停了停。「谢谢你，让这里一直像一个可以回来的地方。」',
    '「城市很大，心愿也很多。可只要知道有人在等我回来，夜路就没有那么长了。」她的声音轻了一点。「下一次，也记得叫上我。」',
  ];
  return replies[count%replies.length];
}
export function act(previous:GameState, action:GameAction):ActionResult {
  const fail=(message:string):ActionResult=>({state:previous,ok:false,message});
  if(action.type==='reset') return {state:createInitialState(),ok:true,message:'新的夜班已开始，演示存档已重置。'};
  const s:GameState=structuredClone(previous);
  if(action.type==='advance') {
    if(!Number.isFinite(action.minutes)||action.minutes<1||action.minutes>180) return fail('每次可推进 1 至 180 分钟。');
    const elapsed=Math.floor(action.minutes),startMinutes=s.minutes,startDay=s.day;
    const moveClock=(offset:number)=>{
      const total=startMinutes+offset;
      s.day=startDay+Math.floor(total/1440);s.minutes=total%1440;
      if(!s.samples.some(x=>x.day===s.day))s.samples.push({day:s.day,income:0,expense:0,reputation:s.reputation});
    };
    // Settle events chronologically so pre-midnight rewards stay in the correct day's ledger.
    const finishing=s.girls.filter(g=>g.status!=='idle'&&g.remaining<=elapsed).sort((a,b)=>a.remaining-b.remaining);
    for(const g of finishing) {
      moveClock(g.remaining);
      g.remaining=0;
      if(g.status==='mission') {
        const m=s.missions.find(m=>m.id===g.missionId);
        if(m&&m.status==='active') {
          m.status='done';s.completed.push(m.id);s.gold+=m.reward;s.reputation=Math.min(100,s.reputation+2);
          g.hp=Math.max(25,g.hp-(m.difficulty==='困难'?18:8));g.fatigue=Math.min(100,g.fatigue+Math.round(m.duration*.35));
          log(s,'finance',`${g.name}完成「${m.title}」，收到委托报酬。`,m.reward);
        }
        delete g.missionId;g.roomId='lounge';
      } else if(g.status==='healing') {g.hp=g.maxHp;g.roomId='lounge';log(s,'care',`${g.name}完成治疗，已经恢复健康。`);}
      else {g.fatigue=Math.max(0,g.fatigue-70);g.hp=Math.min(g.maxHp,g.hp+10);g.roomId='lounge';log(s,'care',`${g.name}休息结束，重新回到待命状态。`);}
      g.status='idle';
      const eventSample=s.samples.find(x=>x.day===s.day);if(eventSample)eventSample.reputation=s.reputation;
    }
    for(const g of s.girls)if(g.status!=='idle')g.remaining=Math.max(0,g.remaining-elapsed);
    moveClock(elapsed);
    const sample=s.samples.find(x=>x.day===s.day);if(sample) sample.reputation=s.reputation;
    s.samples=s.samples.slice(-60);
    return {state:s,ok:true,message:`时间已推进 ${elapsed} 分钟，当前 ${clock(s.minutes)}。`};
  }
  if(action.type==='build') {
    const room=s.rooms.find(r=>r.id===(action.roomId??'dorm'));if(!room) return fail('没有找到这个房间。');
    if(room.level>=4) return fail('这个房间已达到当前可扩建上限。');
    const cost=buildCost(s,room.id);if(s.gold<cost) return fail(`星砂不足，还需要 ${cost-s.gold} 星砂。`);
    room.level++;room.capacity+=room.type==='dorm'?2:1;s.gold-=cost;
    log(s,'base',`${room.name}已升至 ${room.level} 级，${room.type==='dorm'?'新增 2 个契约席位':'可容纳人数增加 1 人'}。`,-cost);
    return {state:s,ok:true,message:`${room.name}扩建完成。`};
  }
  if(action.type==='hire') {
    const candidate=s.candidates.find(g=>g.id===action.girlId);if(!candidate) return fail('这位魔法少女已签约或已离开招募市场。');
    if(s.girls.length>=capacity(s)) return fail('基地契约席位已满，请先扩建晚安宿舍。');
    if(s.gold<candidate.cost) return fail(`星砂不足，还需要 ${candidate.cost-s.gold} 星砂。`);
    s.gold-=candidate.cost;s.candidates=s.candidates.filter(g=>g.id!==candidate.id);
    s.girls.push({...candidate,title:'正式契约',roomId:'lounge'});
    log(s,'finance',`${candidate.name}签署契约，正式加入夜糖事务所。`,-candidate.cost);
    return {state:s,ok:true,message:`欢迎${candidate.name}。会客厅的热可可已经准备好了。`};
  }
  const g=s.girls.find(g=>g.id===action.girlId);if(!g) return fail('没有找到这位契约者。');
  if(action.type==='dispatch') {
    const m=s.missions.find(m=>m.id===action.missionId);if(!m) return fail('这个委托已不在地图上。');
    if(g.status!=='idle') return fail(`${g.name}正在${statusLabels[g.status]}，请等待她完成当前安排。`);
    if(m.status!=='open') return fail('这个委托已被接取或已经完成，请选择其他任务。');
    if(g.hp<30) return fail(`${g.name}的血量低于 30，请先送她去治疗。`);
    if(g.fatigue>=80) return fail(`${g.name}过于疲劳，请先安排休息。`);
    g.status='mission';g.remaining=m.duration;g.missionId=m.id;m.status='active';m.girlId=g.id;
    log(s,'dispatch',`${g.name}出发前往「${m.title}」，预计 ${m.duration} 分钟后归来。`);
    return {state:s,ok:true,message:`${g.name}已出发。愿星光照亮她的归途。`};
  }
  if(action.type==='care') {
    if(g.status!=='idle') return fail(`${g.name}有未完成的安排，请等待当前行动结束。`);
    const heal=action.mode==='healing',room=s.rooms.find(r=>r.type===(heal?'clinic':'dorm'))!;
    if(s.girls.filter(x=>x.status===action.mode&&x.roomId===room.id).length>=room.capacity) return fail(`${room.name}已满，请稍后再来或扩建房间。`);
    if(heal&&g.hp===g.maxHp) return fail(`${g.name}已经很健康，不需要治疗。`);
    if(!heal&&g.fatigue===0) return fail(`${g.name}精神饱满，暂时不需要休息。`);
    if(heal&&s.gold<180) return fail('治疗需要 180 星砂，当前余额不足。');
    g.status=action.mode;g.remaining=heal?60:90;g.roomId=room.id;
    if(heal) s.gold-=180;
    log(s,'care',`${g.name}进入${room.name}，安排${heal?'治疗（60 分钟）':'休息（90 分钟）'}。`,heal?-180:undefined);
    return {state:s,ok:true,message:`已为${g.name}安排${heal?'治疗':'休息'}。推进时间后恢复。`};
  }
  const text=action.text.trim().slice(0,500);if(!text) return fail('先写下你想对她说的话。');
  if(g.status==='mission') return fail(`${g.name}正在出勤，回到基地后再聊聊吧。`);
  const history=s.messages[g.id]??[];
  if(history.length===0) history.push({role:'girl',text:`「所长，今晚想聊些什么？」${g.name}为你留出了身边的位置。`});
  const answer=response(g,text,Math.floor(history.length/2));
  history.push({role:'player',text},{role:'girl',text:answer});s.messages[g.id]=history.slice(-60);
  // Relationship growth is capped per day; this is a local scripted prototype, not an LLM call.
  const today=s.logs.filter(l=>l.kind==='story'&&l.time.startsWith(`第 ${s.day} 日`)&&l.text.includes(`与${g.name}交谈`)).length;
  if(today<3) g.bond=Math.min(100,g.bond+2);
  log(s,'story',`在${s.rooms.find(r=>r.id===g.roomId)?.name??'基地'}与${g.name}交谈：${text.slice(0,32)}${text.length>32?'…':''}`);
  return {state:s,ok:true,message:'对话已记录。'};
}
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const num=(v:unknown,min=0,max=1e9):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const str=(v:unknown):v is string=>typeof v==='string'&&v.length<=3000;
// The prototype roster is fixed; reject prototype keys and unknown imported identities.
const characterIds = new Set(['yue','tang','ling','wu','zhi','lu']);
function validGirl(v:unknown):v is Girl {
  if(!isObject(v)||!isObject(v.stats)||!characterIds.has(v.id as string)) return false;
  return ['id','name','codename','title','element','color','portrait','roomId','skill','description'].every(k=>str(v[k]))
    &&['level','hp','maxHp','fatigue','bond','remaining','cost'].every(k=>num(v[k]))
    &&['idle','mission','healing','resting'].includes(v.status as string)
    &&['magic','insight','agility','empathy'].every(k=>num((v.stats as Record<string,unknown>)[k],0,100))
    &&num(v.fatigue,0,100)&&num(v.bond,0,100)&&num(v.hp,0,v.maxHp as number)
    &&/^\/art\/[a-z]+\.svg$/.test(v.portrait as string);
}
export function loadState(raw:string|null):GameState {
  if(!raw||raw.length>500000) return createInitialState();
  try {
    const s:unknown=JSON.parse(raw);
    if(!isObject(s)||s.version!==1||!num(s.day,1,99999)||!num(s.minutes,0,1439)||!num(s.gold)||!num(s.reputation,0,100)) return createInitialState();
    if(!Array.isArray(s.girls)||!s.girls.length||s.girls.length>30||!s.girls.every(validGirl)||!Array.isArray(s.candidates)||!s.candidates.every(validGirl)) return createInitialState();
    if(!Array.isArray(s.rooms)||s.rooms.length!==4||!s.rooms.every(r=>isObject(r)&&str(r.id)&&str(r.name)&&str(r.description)&&num(r.level,1,4)&&num(r.capacity,1,20)&&['lounge','clinic','dorm','observatory'].includes(r.type as string))) return createInitialState();
    if(!['lounge','clinic','dorm','observatory'].every(id=>(s.rooms as Record<string,unknown>[]).some(r=>r.id===id&&r.type===id))) return createInitialState();
    if(!Array.isArray(s.missions)||s.missions.length>30||!s.missions.every(m=>isObject(m)&&['id','title','category','description','difficulty','color'].every(k=>str(m[k]))&&['x','y','duration','reward','target'].every(k=>num(m[k]))&&['open','active','done'].includes(m.status as string)&&['magic','insight','agility','empathy'].includes(m.requirement as string))) return createInitialState();
    if(!Array.isArray(s.logs)||s.logs.length>300||!s.logs.every(l=>isObject(l)&&str(l.id)&&str(l.time)&&str(l.text)&&['dispatch','finance','care','story','base'].includes(l.kind as string)&&(l.delta===undefined||num(l.delta,-1e9)))) return createInitialState();
    if(!Array.isArray(s.samples)||!s.samples.length||s.samples.length>60||!s.samples.every(x=>isObject(x)&&['day','income','expense','reputation'].every(k=>num(x[k])))) return createInitialState();
    if(!Array.isArray(s.completed)||!s.completed.every(str)||!isObject(s.messages)||!Object.entries(s.messages).every(([id,ms])=>/^[a-z]+$/.test(id)&&Array.isArray(ms)&&ms.length<=60&&ms.every(m=>isObject(m)&&['girl','player','system'].includes(m.role as string)&&str(m.text)))) return createInitialState();
    const all=[...s.girls,...s.candidates] as Girl[];
    if(new Set(all.map(g=>g.id)).size!==all.length||new Set((s.missions as Mission[]).map(m=>m.id)).size!==s.missions.length) return createInitialState();
    if(!(s.girls as Girl[]).every(g=>(s.rooms as Record<string,unknown>[]).some(r=>r.id===g.roomId)&&(g.status!=='mission'||(s.missions as Mission[]).some(m=>m.id===g.missionId&&m.status==='active'&&m.girlId===g.id)))) return createInitialState();
    if(!(s.missions as Mission[]).every(m=>m.status!=='active'||(s.girls as Girl[]).some(g=>g.id===m.girlId&&g.status==='mission'&&g.missionId===m.id))) return createInitialState();
    return s as unknown as GameState;
  } catch {return createInitialState();}
}
