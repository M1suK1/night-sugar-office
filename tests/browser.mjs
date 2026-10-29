import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

const baseURL = process.env.PROTOTYPE_URL ?? 'http://127.0.0.1:5173';
fs.mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
const errors = [], failures = [], results = [];
let currentFlow = '启动';
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(`${currentFlow} | ${m.text()} @ ${m.location().url}`); });
page.on('requestfailed', r => failures.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar-office:v1')));
const stored = async () => { await page.waitForTimeout(120); return state(); };
const nightProposal = {
  version: 2,
  monster: { name: '纸月', epithet: '被折起来的月亮', rank: '游荡', element: '月影系', trait: '害怕被展开', description: '一张悬在空中的纸月亮。', habit: '深夜贴着窗户移动。', weakness: '遇水变软。', maxHp: 132, maxSpirit: 84, stats: { magic: 71, insight: 49, agility: 66, empathy: 35 }, skillIds: ['monster-claw'], rules: [{ trigger: 'roundStart', effect: 'heal', amount: 3 }] },
  candidate: { name: '纸灯', codename: '折光', title: '把夜色折成小船的人', element: '星光系', archetype: '治愈', level: 3, cost: 620, stats: { magic: 64, insight: 58, agility: 52, empathy: 72 }, skillIds: ['glimmer-spear'], traits: [{ name: '夜读', description: '熄灯后才开始写字。', polarity: '正面' }], quote: '我会把灯留给你。', goal: '找到愿意收留纸船的人。', goalKind: '生活', appearance: '短发，发梢有折痕。', personality: '安静，喜欢折纸。', outfit: '宽大的值夜制服。' },
  mission: { title: '窗上的纸月亮', category: '异象调查', description: '一扇窗里同时出现了两个月亮。', work: 'investigation', difficulty: '中危', district: 'oldtown', window: 'urgent', duration: 75, reward: 1200, requirement: 'insight', target: 62, rounds: 5, recommendedLevel: 3, enemyRefs: ['generated'], rewardItemRef: 'loot-1', rewardGirlLevel: 0 },
  opinion: { authorId: 'yue', topic: '经费', faction: 'witch', title: '窗边的空位', text: '有人希望把靠窗的位置留给新来的孩子。', request: '把窗边的位置留给纸灯。', dialogue: [{ speakerId: 'yue', speaker: '月见桃', text: '窗边那个位置，今晚开始空出来了。', expression: 'calm' }, { speakerId: 'yue', speaker: '月见桃', text: '我想把它留给纸灯。她需要一个能看见月亮的地方。', expression: 'sad' }, { speakerId: 'yue', speaker: '月见桃', text: '经费从我的那份里扣，可以吗？', expression: 'shy' }], options: [{ id: 'accept', label: '批准', effect: '从本月经费中拨出一笔钱，把窗边重新布置。', changes: [{ kind: 'gold', amount: -600 }, { kind: 'girl', girlId: 'yue', field: 'bond', amount: 3 }], outcomes: [] }, { id: 'defer', label: '暂缓', effect: '今晚先不动窗边，等下次例会再说。', changes: [{ kind: 'girl', girlId: 'yue', field: 'bond', amount: -1 }, { kind: 'faction', faction: 'witch', amount: -2 }], outcomes: [] }, { id: 'reject', label: '驳回', effect: '窗边保持原样，经费也不能动。', changes: [{ kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 }, { kind: 'faction', faction: 'witch', amount: -4 }, { kind: 'gold', amount: -300 }], outcomes: [] }] },
  envoy: { faction: 'association', title: '替协会送一盏灯', description: '把灯送到旧车站。', work: 'investigation', difficulty: '中危', district: 'station', window: 'urgent', duration: 45, reward: 720, requirement: 'empathy', target: 52, rounds: 3, recommendedLevel: 2, enemyRefs: ['generated'], rewardGirlLevel: 0 },
  loot: [{ ref: 'loot-1', name: '折月灯罩', faction: 'witch', slot: 'charm', description: '纸折的灯罩，能把月光收得很小。', stats: { insight: 4 }, passive: '' }],
};
const close = async () => { if (await page.locator('dialog[open]').count()) await page.locator('#modal-close').click(); };
async function settleIncidents() {
  for (let i = 0; i < 4; i++) {
    const overlay = page.locator('.incident-overlay');
    if (!(await overlay.count())) return;
    await page.locator('.incident-option').first().click();
    await page.waitForTimeout(250);
  }
}
const openMission = id => page.evaluate(target => document.getElementById(`mission-${target}`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), id);
async function check(name, fn) { currentFlow = name; try { await settleIncidents(); await fn(); results.push({ name, pass: true }); console.log(`PASS ${name}`); } catch (e) { results.push({ name, pass: false, error: e.message }); console.error(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: 'artifacts/failure.png', fullPage: true, animations: 'disabled' }); throw e; } }
async function layout(label) {
  const issues = await page.evaluate(() => { const seen = new Set(), duplicates = []; for (const e of document.querySelectorAll('[id]')) { if (seen.has(e.id)) duplicates.push(e.id); seen.add(e.id); } const missing = [...document.querySelectorAll('button,input,textarea,select,a')].filter(e => !e.id).map(e => `${e.tagName}:${e.textContent?.slice(0, 24)}`); return { width: innerWidth, scroll: document.documentElement.scrollWidth, duplicates, missing }; });
  expect(issues.duplicates, `${label} duplicate IDs`).toEqual([]); expect(issues.missing, `${label} interactive IDs`).toEqual([]); expect(issues.scroll, `${label} horizontal overflow`).toBeLessThanOrEqual(issues.width + 1);
}
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
  await page.locator('#start-standard').click();
  await expect(page.locator('.map-viewport')).toBeVisible();
  await check('首页地图、首批时段委托与分类筛选', async () => {
    const open = (await stored()).missions.filter(m => m.status === 'open');
    await expect(page.locator('.mission-pin')).toHaveCount(open.length);
    await expect(page.locator('.girl-roster-card')).toHaveCount(4);
    await page.locator('#map-filter-combat').click();
    await expect(page.locator('.mission-pin:not(.filtered)')).toHaveCount(open.filter(m => m.work === 'combat').length);
    await page.locator('#map-filter-investigation').click();
    await expect(page.locator('.mission-pin:not(.filtered)')).toHaveCount(open.filter(m => m.work === 'investigation').length);
    await page.locator('#map-filter-all').click();
    const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
    expect(broken).toEqual([]); await layout('desktop');
    await page.screenshot({ path: 'artifacts/dispatch-desktop.png', fullPage: true, animations: 'disabled' });
  });
  await check('会客厅：独立页面、三栏布局与决议落账', async () => {
    await page.locator('#nav-council').click();
    await expect(page.locator('.council-stage')).toBeVisible();
    await expect(page.locator('.council-side')).toBeVisible();
    await expect(page.locator('.council-assistant')).toBeVisible();
    const before = (await stored()).opinions.filter(o => o.status === 'pending').length;
    if (before > 0) {
      await expect(page.locator('.council-dialogue')).toBeVisible();
      await expect(page.locator('#council-option-accept')).toBeHidden();
      const firstLine = await page.locator('.council-dialogue-text').innerText();
      await page.locator('#council-dialogue-next').click();
      await expect(page.locator('.council-dialogue-text')).not.toHaveText(firstLine);
      await page.screenshot({ path: 'artifacts/council-dialogue.png', fullPage: true, animations: 'disabled' });
      await page.locator('#council-dialogue-skip').click();
      await expect(page.locator('.council-dialogue')).toHaveCount(0);
      await expect(page.locator('#council-option-accept')).toBeVisible();
      await expect(page.locator('.council-option-tags')).toHaveCount(3);
      await expect(page.locator('#council-option-accept .council-option-tags')).toContainText(/星砂|分钟|安定度|羁绊|态度/);
      await expect(page.locator('#council-option-reject')).toContainText('扣掉相应资源');
      await layout('council');
      await page.screenshot({ path: 'artifacts/council.png', fullPage: true, animations: 'disabled' });
      await page.locator('#council-option-accept').click();
      await page.waitForTimeout(900);
      const after = (await stored()).opinions.filter(o => o.status === 'pending').length;
      expect(after).toBe(before - 1);
    } else {
      await layout('council');
      await page.screenshot({ path: 'artifacts/council.png', fullPage: true, animations: 'disabled' });
    }
    await page.locator('#nav-dispatch').click();
  });  await check('人物档案：四页、技能池、疤痕槽与关系七阶键盘导航', async () => {
    await page.locator('#roster-girl-yue').hover(); await expect(page.locator('#tooltip-yue')).toBeVisible();
    await page.locator('#roster-girl-yue').click();
    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.locator('.scar-slot')).toHaveCount(5);
    await page.locator('#dossier-tab-overview').focus(); await page.keyboard.press('ArrowRight');
    await expect(page.locator('#dossier-tab-ability')).toBeFocused(); await expect(page.locator('#dossier-tab-ability')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.skill-card')).toHaveCount(3);
    await page.locator('#dossier-tab-relations').click();
    await expect(page.locator('.relation-legend span')).toHaveCount(7);
    await expect(page.locator('.peer-row')).toHaveCount(4);
    await page.locator('#dossier-tab-memory').click(); await expect(page.locator('.bond-emblem')).toContainText(/与你的羁绊\d+\/100/);
    await page.locator('#dossier-tab-overview').click(); await layout('character dialog');
    await page.screenshot({ path: 'artifacts/character-dossier.png', fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape'); await expect(page.locator('#roster-girl-yue')).toBeFocused();
  });
  await check('双人调查编队、确认后按实际时间结算', async () => {
    await page.locator('#mission-candy').click();
    await expect(page.locator('#dispatch-confirm')).toBeDisabled();
    await page.locator('#assign-yue').click(); await page.locator('#assign-tang').click();
    await expect(page.locator('#dispatch-confirm')).toBeEnabled();
    await page.locator('#dispatch-confirm').click();
    const candy = (await stored()).missions.find(m => m.id === 'candy');
    expect(candy.squad).toEqual(['yue', 'tang']);
    const goldBeforeCandy = (await stored()).gold;
    await page.locator('#advance-time-30').click(); await page.locator('#advance-time-30').click();
    await expect.poll(async () => (await stored()).missions.find(m => m.id === 'candy').status).toBe('done');
    expect((await stored()).gold).toBe(goldBeforeCandy + candy.reward);
  });
  await check('三人战斗编队、自动战斗与报告回放', async () => {
    await page.locator('#mission-station').click();
    await expect(page.locator('.enemy-card')).toHaveCount(2);
    await page.locator('#assign-yue').click(); await page.locator('#assign-tang').click(); await page.locator('#assign-ling').click();
    await page.locator('#dispatch-confirm').click();
    await page.locator('#advance-time-30').click(); await page.locator('#advance-time-30').click();
    await expect(page.locator('#battle-tab-replay')).toBeVisible();
    await expect(page.locator('.battle-stage')).toBeVisible();
    await expect(page.locator('.battle-log')).toContainText('第');
    await expect(page.locator('.event-formula').first()).toContainText('魔力');
    await expect(page.locator('.event-formula').first()).toContainText('d100');
    await page.screenshot({ path: 'artifacts/battle-replay.png', fullPage: true, animations: 'disabled' });
    await page.locator('#battle-skip').click();
    await expect(page.locator('#battle-report-table')).toBeVisible();
    await expect(page.locator('.battle-outcome')).toContainText('击退');
    const saved = await stored();
    expect(saved.battles[0].outcome).toBe('repelled');
    expect(['open', 'expired']).toContain(saved.missions.find(m => m.id === 'station').status);
    await page.locator('#battle-note-open').click();
    await expect(page.locator('.battle-note-shell')).toBeVisible();
    await expect(page.locator('#battle-note-generate')).toBeVisible();
    await page.locator('#battle-note-generate').click();
    await expect(page.locator('#battle-note-regenerate')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.battle-note-source')).toContainText('简报版');
    await expect(page.locator('.battle-note-narration').first()).toContainText('回合');
    await expect.poll(async () => (await stored()).battleNotes?.length).toBe(1);
    await page.screenshot({ path: 'artifacts/battle-note.png', animations: 'disabled' });
    await page.locator('#battle-note-close').click();
    await expect(page.locator('#battle-close')).toBeVisible();
    await page.locator('#battle-close').click();
  });
  await check('图鉴与纪念墙始终可从侧栏进入', async () => {
    await page.locator('#open-codex').click();
    await expect(page.locator('.codex-list button')).toHaveCount(6);
    await page.locator('#codex-hollow-moon').click();
    await expect(page.locator('.codex-detail')).toContainText('空月');
    await page.screenshot({ path: 'artifacts/codex-desktop.png', fullPage: true, animations: 'disabled' });
    await close();
    await page.locator('#open-memorial').click();
    await expect(page.locator('.memorial-empty')).toContainText('纪念墙还没有名字');
    await close();
  });
  await check('基地对话与宿舍扩建按新费用结算', async () => {
    await page.locator('#nav-base').click(); await layout('base');
    await page.locator('#av-base-talk-tang').click();
    await page.locator('#chat-input').fill('今晚的编队，辛苦了。'); await page.locator('#chat-send').click();
    await expect(page.locator('.chat-message.player').last()).toContainText('今晚的编队');
    await close();
    const before = await stored();
    await page.locator('#av-base-expand').click();
    await page.locator('#build-room-dorm').click(); await page.locator('#build-confirm').click();
    const after = await stored();
    expect(after.rooms.find(r => r.id === 'dorm').capacity).toBe(8);
    expect(after.gold).toBe(before.gold - 7200);
  });
  await check('市场筛选、档案与签约', async () => {
    await page.locator('#nav-market').click(); await layout('market');
    await page.locator('#av-market-search').fill('鹿铃');
    await expect(page.locator('.av-candidate')).toHaveCount(1);
    await page.locator('#av-market-preview-lu').click(); await expect(page.locator('dialog')).toContainText('鹿铃');
    await close();
    const before = await stored();
    await page.locator('#av-market-hire-lu').click(); await page.locator('#hire-confirm').click();
    const after = await stored();
    expect(after.girls).toHaveLength(6); expect(after.gold).toBe(before.gold - 3200);
  });
  await check('经营折线图、战斗档案与日志筛选', async () => {
    await page.locator('#nav-records').click(); await layout('records');
    await page.locator('#av-record-range').selectOption('14');
    await expect(page.locator('.av-chart-point')).toHaveCount(14);
    await expect(page.locator('.av-battle-row')).toHaveCount(1);
    await page.locator('#av-record-battle-title').scrollIntoViewIfNeeded();
    const battleId = (await stored()).battles[0].id;
    await expect(page.locator('.av-battle-note-mark')).toHaveCount(1);
    await expect(page.locator(`#records-note-${battleId}`)).toBeVisible();
    await page.screenshot({ path: 'artifacts/records-desktop.png', fullPage: true, animations: 'disabled' });
    await page.locator(`#av-record-battle-${battleId}`).click();
    await expect(page.locator('#battle-tab-replay')).toBeVisible();
    await page.locator('#battle-tab-report').click();
    await expect(page.locator('#battle-report-table')).toBeVisible(); await page.locator('#battle-close').click();
    await page.locator(`#records-note-${battleId}`).click();
    await expect(page.locator('.battle-note-shell')).toBeVisible();
    await expect(page.locator('.battle-note-scene')).toHaveCount(3);
    await page.locator('#battle-note-close').click();
    await page.locator('#battle-close').click();
    await page.evaluate(({ battleId }) => {
      const key = 'night-sugar-office:v1';
      const raw = JSON.parse(localStorage.getItem(key));
      const battle = raw.battles.find(item => item.id === battleId);
      const ally = battle.units.find(unit => unit.side === 'ally');
      battle.units.push({
        ...ally, uid: 'enemy-norma', side: 'enemy', girlId: 'enemy-norma',
        name: '诺玛', codename: 'NORMA LOCKE', expression: 'smile', color: '#c98da8',
      });
      const note = raw.battleNotes.find(item => item.battleId === battleId);
      note.scenes[0].lines = [{
        round: 1, speakerSide: 'enemy', speakerId: 'enemy-norma', expression: 'smile',
        text: '……人家说不用你啦，BOSS。', mode: 'speech',
      }];
      localStorage.setItem(key, JSON.stringify(raw));
    }, { battleId });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-records').click(); await layout('records');
    await page.locator(`#records-note-${battleId}`).click();
    await expect(page.locator('.battle-note-side.right .battle-note-portrait')).toHaveCount(1);
    await expect(page.locator('.battle-note-side.right')).toContainText('诺玛');
    await expect(page.locator('.battle-note-line.right')).toHaveCount(1);
    await page.screenshot({ path: 'artifacts/battle-note-enemy.png', animations: 'disabled' });
    await page.locator('#battle-note-close').click();
    await page.locator('#battle-close').click();
    await page.locator('#av-record-log-filter').selectOption('battle');
    await expect(page.locator('.av-log-item')).toHaveCount(1);
    await expect(page.locator('.av-log-item')).toContainText('战斗');
  });
  await check('休息安排、通知、导出与刷新恢复', async () => {
    await page.locator('#nav-dispatch').click();
    await page.locator('#roster-girl-yue').click(); await page.locator('#girl-rest').click();
    expect((await stored()).girls.find(g => g.id === 'yue').status).toBe('resting');
    await close();
    await page.locator('#open-settings').click();
    const download = page.waitForEvent('download');
    await page.locator('#settings-export-save').click();
    expect((await download).suggestedFilename()).toContain('存档.json');
    await close();
    await page.locator('#open-notifications').click(); await expect(page.locator('.notification-list')).toBeVisible(); await close();
    const before = await stored(); await page.reload({ waitUntil: 'networkidle' });
    expect((await stored()).gold).toBe(before.gold); expect((await stored()).girls).toHaveLength(6);
  });
  await check('自动推进开关与操作指南', async () => {
    await page.locator('#toggle-auto-time').click(); await expect(page.locator('#toggle-auto-time')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#toggle-auto-time').click();
    await page.locator('#open-help').click(); await expect(page.locator('.help-items>div')).toHaveCount(6);
    await page.keyboard.press('Escape'); await expect(page.locator('#open-help')).toBeFocused();
  });
  await check('响应式 1024、768、390、320 无横向溢出', async () => {
    for (const width of [1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const nav of ['dispatch', 'base', 'council', 'market', 'records']) { await page.locator(`#nav-${nav}`).click(); await layout(`${width}-${nav}`); if (width === 390) await page.screenshot({ path: `artifacts/${nav}-mobile.png`, fullPage: true, animations: 'disabled' }); }
      if (width === 390) { await page.locator('#nav-dispatch').click(); await page.locator('#roster-girl-tang').click(); await layout('mobile character'); await close(); }
    }
    await page.setViewportSize({ width: 1440, height: 1080 });
  });
  await check('重置后回到初始夜晚并清空战斗与纪念', async () => {
    await page.locator('#open-settings').click(); await page.locator('#settings-reset-save').click();
    await page.locator('#reset-confirm').click();
    const s = await stored();
    expect(s.gold).toBe(12840); expect(s.girls).toHaveLength(5); expect(s.battles).toEqual([]); expect(s.memorial).toEqual([]);
    await page.locator('#dismiss-toast').click();
  });
  await check('契约成长页：目标、经验、契约与诊所入口', async () => {
    await page.locator('#nav-dispatch').click();
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-growth').click();
    await expect(page.locator('.growth-hero')).toContainText(/当前目标/);
    await expect(page.locator('.contract-grid')).toContainText('退休金标准');
    await expect(page.locator('#girl-renew')).toBeEnabled();
    await expect(page.locator('#clinic-clone')).toBeDisabled();
    await expect(page.locator('.clinic-panel')).toBeVisible();
    await layout('growth dossier');
    await page.screenshot({ path: 'artifacts/character-growth.png', fullPage: true, animations: 'disabled' });
    await close();
  });
  await check('基地议事与星象台远行按小时结算', async () => {
    await page.locator('#nav-base').click();
    await expect(page.locator('#av-council-accept')).toBeVisible();
    const before = (await stored()).gold;
    await page.locator('#av-council-accept').click();
    await expect.poll(async () => (await stored()).gold).toBe(before - 900);
    await expect(page.locator('.av-op-quiet')).toContainText('会客厅暂时安静');
    await page.locator('#av-expedition-pick-yue').click();
    await page.locator('#av-expedition-pick-tang').click();
    await page.locator('#av-expedition-start').click();
    await expect.poll(async () => (await stored()).expeditions.length).toBe(1);
    await page.locator('#advance-time-30').click(); await page.locator('#advance-time-30').click();
    await expect.poll(async () => (await stored()).expeditions[0]?.cyclesDone ?? 0).toBe(1);
    await page.screenshot({ path: 'artifacts/base-operations.png', fullPage: true, animations: 'disabled' });
    await page.locator('#av-expedition-recall').click();
    await expect.poll(async () => (await stored()).expeditions.length).toBe(0);
  });
  await check('退休区、退休金与远程手机联络', async () => {
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('night-sugar-office:v1'));
      const yue = raw.girls.find(g => g.id === 'yue');
      const scar = i => ({ id: `test-scar-${i}`, name: '旧伤', kind: 'physical', condition: '阴雨天会疼', description: '她不太提起。', effect: { kind: 'stat', stat: 'agility', amount: -1 }, maxHpLoss: 8, gainedAt: '第 13 日 · 02:10', missionId: 'mirror' });
      yue.retired = true; yue.retiredReason = 'contract'; yue.status = 'retired'; yue.scars = [1, 2, 3, 4].map(scar);
      yue.contractEndDay = 14; yue.pensionMissed = 2; yue.roomId = 'dorm';
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-market').click();
    await page.locator('#av-market-tab-retired').click();
    await expect(page.locator('.av-retired-card')).toHaveCount(2);
    await expect(page.locator('.av-retired-card:has(#av-market-remote-yue)')).toContainText('退休金');
    await page.locator('#av-market-remote-yue').click();
    await expect(page.locator('.remote-banner')).toContainText('远程联络 · 手机');
    const before = (await stored()).gold;
    await page.locator('#chat-input').fill('退休以后，睡得还好吗？');
    await page.locator('#chat-send').click();
    await expect.poll(async () => (await stored()).gold).toBe(before - 40);
    await page.screenshot({ path: 'artifacts/retired-remote.png', fullPage: true, animations: 'disabled' });
    await close();
  });
  await check('市场四标签、升级与自定义登记', async () => {
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-market').click();
    await expect(page.locator('#av-market-tab-candidates')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.av-candidate')).toHaveCount(1);
    await page.locator('#av-market-tab-contracts').click();
    await expect(page.locator('.av-contract-row')).toHaveCount(4);
    await page.locator('#av-market-tab-supplies').click();
    await expect(page.locator('.av-supply-card').first()).toBeVisible();
    await page.locator('#av-market-tab-retired').click();
    await expect(page.locator('.av-retired-card')).toHaveCount(1);
    await page.locator('#av-market-tab-candidates').click();
    await page.locator('#av-market-upgrade').click();
    await expect.poll(async () => (await stored()).marketLevel).toBe(2);
    await page.locator('#av-market-custom').click();
    await expect(page.locator('#custom-entry-import')).toBeVisible();
    await page.locator('#custom-entry-blank').click();
    await expect(page.locator('.custom-steps [role="tab"]')).toHaveCount(5);
    await page.locator('#custom-name').fill('测试契约');
    await page.locator('#custom-next').click();
    await page.locator('#custom-autofill').click();
    await page.locator('#custom-next').click();
    for (let i = 0; i < 3; i++) await page.locator('.custom-pick').nth(i).click();
    await page.locator('#custom-next').click();
    for (let i = 0; i < 3; i++) await page.locator('.custom-pick').nth(i).click();
    await page.locator('#custom-next').click();
    await page.locator('#custom-create').click();
    await expect.poll(async () => (await stored()).candidates.some(g => g.name === '测试契约')).toBe(true);
  });
  await check('断药期禁止派遣与 Boss 危机横幅', async () => {
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('night-sugar-office:v1'));
      const yue = raw.girls.find(g => g.id === 'yue');
      yue.witch = true; yue.corruption = 80; yue.withdrawalDays = 5; yue.drugUntilDay = 13; yue.status = 'idle';
      raw.boss = { id: 'boss-test', appearedDay: raw.day, lastTick: 0, deadline: raw.day * 1440 + 1200, missionId: 'boss-test' };
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.boss-banner')).toContainText('空月降临');
    await expect(page.locator('.girl-roster-card:has(#roster-girl-yue)')).toContainText('断药');
    await page.locator('#mission-station').click();
    await expect(page.locator('#assign-yue')).toBeDisabled();
    await page.screenshot({ path: 'artifacts/withdrawal-boss.png', fullPage: true, animations: 'disabled' });
    await close();
  });
  await check('主页三方势力态度、基地平面图内嵌模块与记录页 v4 台账', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#dispatch-faction-witch')).toContainText('中立');
    await expect(page.locator('#dispatch-faction-association')).toContainText('中立');
    await expect(page.locator('#dispatch-faction-government')).toContainText('中立');
    await page.screenshot({ path: 'artifacts/dispatch-desktop.png', fullPage: true, animations: 'disabled' });

    await page.locator('#nav-base').click();
    await expect(page.locator('.av-floorplan-integrated')).toBeVisible();
    await page.locator('#av-lounge-tab-envoys').click();
    await expect(page.locator('.av-floorplan-integrated #av-envoy-accept-witch')).toBeVisible();
    await page.locator('#av-envoy-accept-association').click();
    await page.locator('#av-clinic-tab-surgery').click();
    await expect(page.locator('.av-floorplan-integrated #av-clinic-wipe-yue')).toBeVisible();
    await page.screenshot({ path: 'artifacts/base-desktop.png', fullPage: true, animations: 'disabled' });

    await page.locator('#nav-records').click();
    await expect(page.locator('.av-record-summary-v4 .av-record-stat')).toHaveCount(4);
    await expect(page.locator('.av-record-faction-card')).toHaveCount(3);
    await expect(page.locator('.av-soul-card')).toHaveCount(5);
    await page.screenshot({ path: 'artifacts/records-desktop.png', fullPage: true, animations: 'disabled' });
  });
  await check('外观装备页：三套衣柜、六种表情、侵蚀归位与拖拽装备', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('night-sugar-office:v1'));
      raw.inventory = { 'moon-weapon': 2, 'star-charm': 1 };
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await expect(page.locator('.corruption-inline')).toBeVisible();
    await expect(page.locator('.corruption-inline')).toContainText('侵蚀度');
    await page.locator('#dossier-tab-appearance').click();
    await expect(page.locator('.wardrobe-tile')).toHaveCount(5);
    await expect(page.locator('#dossier-wardrobe-import')).toBeVisible();
    await expect(page.locator('.expression-tile')).toHaveCount(6);
    await page.locator('#dossier-outfit-casual').click();
    await page.locator('#dossier-expression-shy').click();
    await expect.poll(async () => {
      const girl = (await stored()).girls.find(g => g.id === 'yue');
      return `${girl.outfitId}:${girl.expression}`;
    }).toBe('casual:shy');
    await page.locator('#dossier-equipment-weapon').click();
    await expect(page.locator('.equipment-drawer')).toBeVisible();
    await page.screenshot({ path: 'artifacts/armory-desktop.png', animations: 'disabled' });
    await page.locator('#dossier-gear-moon-weapon').dragTo(page.locator('#equipment-drop-weapon'));
    await expect.poll(async () => (await stored()).girls.find(g => g.id === 'yue').equipment.weapon).toBe('moon-weapon');
    await page.locator('#equipment-drawer-close').click();
    await page.screenshot({ path: 'artifacts/appearance-desktop.png', fullPage: true, animations: 'disabled' });
    await close();
  });
  await check('表情差分：按服装导入、批量识别、切换立绘与移除', async () => {
    const face = (color, label) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="${color}"/><circle cx="40" cy="42" r="24" fill="#f7dce8"/><text x="40" y="90" text-anchor="middle" font-size="12" fill="#20101a">${label}</text></svg>`);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-expression-manage').click();
    await expect(page.locator('.expression-variant-modal')).toBeVisible();
    await expect(page.locator('.expression-variant-card')).toHaveCount(6);
    await page.locator('#expression-variant-file-calm').setInputFiles({ name: 'yue-calm.svg', mimeType: 'image/svg+xml', buffer: face('#7ec8ff', 'CALM') });
    await expect.poll(async () => Object.keys((await stored()).girls.find(g => g.id === 'yue').importedVariants ?? {}).length).toBe(1);
    await expect(page.locator('#expression-variant-file-shy')).toBeEnabled();
    await page.locator('#expression-variant-file-shy').setInputFiles({ name: 'yue-shy.svg', mimeType: 'image/svg+xml', buffer: face('#f3aec9', 'SHY') });
    await expect.poll(async () => Object.keys((await stored()).girls.find(g => g.id === 'yue').importedVariants ?? {}).length).toBe(2);
    await expect(page.locator('#expression-variant-batch')).toBeEnabled();
    await page.locator('#expression-variant-batch').setInputFiles([
      { name: 'yue-smile.svg', mimeType: 'image/svg+xml', buffer: face('#ffd38a', 'SMILE') },
      { name: 'yue-surprise.svg', mimeType: 'image/svg+xml', buffer: face('#b69cff', 'SURPRISE') },
    ]);
    await expect.poll(async () => Object.keys((await stored()).girls.find(g => g.id === 'yue').importedVariants ?? {}).length).toBe(4);
    await expect(page.locator('.expression-variant-state.ready')).toHaveCount(4);
    const outfitCount = (await stored()).girls.find(g => g.id === 'yue').wardrobe.length;
    await expect(page.locator('.expression-variant-outfits button')).toHaveCount(outfitCount);
    await page.locator('#expression-variant-outfit-casual').click();
    await expect(page.locator('.expression-variant-state.ready')).toHaveCount(0);
    await page.locator('#expression-variant-file-calm').setInputFiles({ name: 'yue-calm.svg', mimeType: 'image/svg+xml', buffer: face('#9edfc4', 'CALM') });
    await expect.poll(async () => Object.keys((await stored()).girls.find(g => g.id === 'yue').importedVariants ?? {}).length).toBe(5);
    await expect(page.locator('#expression-variant-outfit-casual')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.expression-variant-state.ready')).toHaveCount(1);
    await page.locator('#expression-variant-remove-calm').click();
    await expect.poll(async () => Object.keys((await stored()).girls.find(g => g.id === 'yue').importedVariants ?? {}).length).toBe(4);
    await expect(page.locator('#expression-variant-outfit-casual')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#expression-variant-outfit-uniform').click();
    await expect(page.locator('.expression-variant-state.ready')).toHaveCount(4);
    await page.screenshot({ path: 'artifacts/expression-variants.png', animations: 'disabled' });

    await page.locator('#expression-variant-close').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-expression-calm').click();
    const calmSrc = await page.locator('.dossier-art .girl-portrait.imported img').getAttribute('src');
    await page.locator('#dossier-expression-shy').click();
    const shySrc = await page.locator('.dossier-art .girl-portrait.imported img').getAttribute('src');
    expect(calmSrc).not.toBe(shySrc);
    const outfitId = (await stored()).girls.find(g => g.id === 'yue').outfitId;
    expect(calmSrc).toContain('data:image/webp');
    expect(shySrc).toContain('data:image/webp');

    await page.locator('#dossier-outfit-casual').click();
    await expect(page.locator('.dossier-art .girl-portrait.imported')).toHaveCount(0);
    await page.locator('#dossier-outfit-uniform').click();
    await page.locator('#dossier-expression-manage').click();
    await page.locator('#expression-variant-remove-shy').click();
    await expect.poll(async () => Object.keys((await stored()).girls.find(g => g.id === 'yue').importedVariants ?? {}).length).toBe(3);
    await page.locator('#expression-variant-close').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-expression-shy').click();
    await expect(page.locator('.dossier-art .girl-portrait.imported')).toHaveCount(0);
    expect(outfitId).toBe('uniform');
    await close();
  });
  await check('势力物资每日货位、单次限购与售罄状态', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-market').click();
    await page.locator('#av-market-tab-supplies').click();
    await expect(page.locator('.av-supply-card')).toHaveCount(9);
    const firstBuy = page.locator('.av-supply-card button:not([disabled])').first();
    const buyId = await firstBuy.getAttribute('id');
    await firstBuy.click();
    await expect(page.locator(`#${buyId}`)).toBeDisabled();
    await expect(page.locator(`#${buyId}`)).toContainText('已售罄');
    const sold = (await stored()).marketStock.filter(entry => entry.sold);
    expect(sold.length).toBe(1);
    await page.screenshot({ path: 'artifacts/market-supplies.png', fullPage: true, animations: 'disabled' });
    await close();
  });
  await check('完成委托可回看战斗记录', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#mission-mirror').click();
    for (const id of ['yue', 'tang', 'ling']) await page.locator(`#assign-${id}`).click();
    await page.locator('#dispatch-confirm').click();
    for (let i = 0; i < 3; i++) await page.locator('#advance-time-30').click();
    await page.locator('#battle-skip').click();
    await page.locator('#battle-close').click();
    await page.locator('#mission-mirror').click();
    await expect(page.locator('#mission-view-battle')).toBeVisible();
    await page.screenshot({ path: 'artifacts/mission-completed.png', animations: 'disabled' });
    await page.locator('#mission-view-battle').click();
    await expect(page.locator('.battle-theater')).toBeVisible();
    await page.locator('#battle-close').click();
  });
  await check('自定义登记：只导入立绘、逐字段补全与未确认不落库', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 500;
      const ctx = canvas.getContext('2d'); if (!ctx) return '';
      const gradient = ctx.createLinearGradient(0, 0, 0, 500); gradient.addColorStop(0, '#2b1c31'); gradient.addColorStop(1, '#120d18');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 400, 500); ctx.fillStyle = '#f3aec9'; ctx.beginPath(); ctx.arc(200, 210, 90, 0, Math.PI * 2); ctx.fill();
      return canvas.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync('artifacts/fixture-portrait.png', Buffer.from(png, 'base64'));
    let calls = 0;
    let imageSent = false;
    await page.route('**/chat/completions', route => {
      calls += 1;
      const payload = route.request().postDataJSON();
      imageSent = imageSent || Array.isArray(payload?.messages?.[1]?.content) && payload.messages[1].content.some(part => part.type === 'image_url');
      const content = { name: calls === 1 ? '使魔草稿' : '重写后的名字', codename: '折光', title: '把夜色折成小船的人', element: '星光系', archetype: '治愈', quote: '我会把灯留给你。', goal: '找到愿意收留纸船的人。', appearance: '短发，发梢有折痕。', personality: '安静，喜欢折纸。', outfitDescription: '宽大的值夜制服。', focus: 'empathy', skillIds: ['glimmer-spear', 'peach-ward', 'starlight-fall'], traitIds: ['cat-sense', 'protective', 'star-allergy'] };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }) });
    });
    await page.evaluate(() => localStorage.setItem('night-sugar:llm-config', JSON.stringify({ endpoint: 'https://mock.local/v1', apiKey: 'test-key', model: 'mock' })));
    const before = (await stored()).candidates.length;
    await page.locator('#nav-market').click();
    await page.locator('#av-market-custom').click();
    await expect(page.locator('#custom-entry-import')).toBeVisible();
    await page.setInputFiles('#custom-portrait-file', 'artifacts/fixture-portrait.png');
    await expect(page.locator('#custom-draft')).toBeVisible();
    await page.locator('#custom-draft').click();
    await expect(page.locator('#custom-rewrite-name')).toBeVisible();
    await expect(page.locator('#custom-name')).toHaveValue('使魔草稿');
    await expect(page.locator('.field-origin')).toHaveCount(7);
    await page.screenshot({ path: 'artifacts/custom-autofill.png', animations: 'disabled' });
    await page.locator('#custom-step-1').click();
    expect((await page.locator('.custom-stat-row b').allInnerTexts()).join(',')).toBe('56,68,48,88');
    expect(imageSent).toBe(true);
    await page.locator('#custom-step-0').click();
    await page.locator('#custom-rewrite-name').click();
    await expect(page.locator('#custom-name')).toHaveValue('重写后的名字');
    await expect(page.locator('#custom-regenerate-all')).toBeVisible();
    expect((await stored()).candidates.length).toBe(before);
    await close();
    await page.unroute('**/chat/completions');
    await page.evaluate(() => { localStorage.removeItem('night-sugar:llm-config'); localStorage.removeItem('night-sugar:llm-prompts'); localStorage.removeItem('night-sugar:llm-auto'); });
    await page.reload({ waitUntil: 'networkidle' });
  });
  await check('只导入立绘后可手动完成登记', async () => {
    await page.locator('#nav-market').click();
    await page.locator('#av-market-custom').click();
    await page.setInputFiles('#custom-portrait-file', 'artifacts/fixture-portrait.png');
    await page.locator('#custom-gate-cutout').click();
    await expect(page.locator('.cutout-preview')).toBeVisible();
    const cutPair = await page.locator('.cutout-figure img').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
    expect(cutPair[0]).not.toBe(cutPair[1]);
    await page.locator('#cutout-apply').click();
    await expect(page.locator('.cutout-preview')).toHaveCount(0);
    await expect(page.locator('.custom-gate-draft img')).toHaveAttribute('src', /^data:image\/png/);
    await page.locator('#custom-gate-manual').click();
    await page.locator('#custom-name').fill('门口登记');
    await page.locator('#custom-next').click();
    await page.locator('#custom-next').click();
    for (let i = 0; i < 3; i++) await page.locator('.custom-pick').nth(i).click();
    await page.locator('#custom-next').click();
    for (let i = 0; i < 3; i++) await page.locator('.custom-pick').nth(i).click();
    await page.locator('#custom-next').click();
    await expect(page.locator('#custom-create')).toBeEnabled();
    await page.locator('#custom-create').click();
    await expect.poll(async () => (await stored()).candidates.some(g => g.name === '门口登记')).toBe(true);
    await close();
  });  await check('模型对话与生成内容编年史', async () => {
    await page.evaluate(() => localStorage.setItem('night-sugar:llm-config', JSON.stringify({ endpoint: 'https://mock.local/v1', apiKey: 'test-key', model: 'mock' })));
    await page.route('**/chat/completions', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '「今晚的月色像一颗没拆开的糖。」她把手机贴近耳边。' } }] }) }));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await page.locator('#girl-talk').click();
    await page.locator('#chat-input').fill('今晚的月亮好看吗？');
    await page.locator('#chat-send').click();
    await expect(page.locator('.chat-message.girl').last()).toContainText('没拆开的糖');
    await expect(page.locator('.chat-message.typing')).toHaveCount(0);
    await close();
    await page.unroute('**/chat/completions');
    await page.evaluate(() => { const key = 'night-sugar-office:v1'; const saved = JSON.parse(localStorage.getItem(key)); saved.chronicle = [{ id: 'ch-browser', day: 14, at: '21:40', kind: '魔物', title: '纸月', summary: '被折起来的月亮在窗外停了一夜。' }]; localStorage.setItem(key, JSON.stringify(saved)); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-records').click();
    await page.locator('#av-record-chronicle').click();
    await expect(page.locator('.chronicle-entry')).toHaveCount(1);
    await page.locator('#chronicle-filter-魔物').click();
    await expect(page.locator('.chronicle-entry h3')).toHaveText('纸月');
    await page.screenshot({ path: 'artifacts/chronicle-desktop.png', animations: 'disabled' });
    await close();
    await page.evaluate(() => { localStorage.removeItem('night-sugar:llm-config'); });
  });
  await check('完整提案先预览，采纳后才写入事务所与装备库', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('night-sugar:llm-config', JSON.stringify({ endpoint: 'https://mock.local/v1', apiKey: 'test-key', model: 'mock' })));
    await page.route('**/chat/completions', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(nightProposal) } }] }) }));
    const before = await stored();
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-llm-generate').click();
    await expect(page.locator('.proposal-modal')).toBeVisible();
    await expect(page.locator('.proposal-modal')).toContainText('纸月');
    await expect(page.locator('.proposal-modal')).toContainText('折月灯罩');
    await expect(page.locator('.proposal-options article')).toHaveCount(3);
    await expect(page.locator('.proposal-options article').first()).toContainText('星砂');
    await expect.poll(async () => (await stored()).candidates.length).toBe(before.candidates.length);
    await layout('proposal');
    await page.screenshot({ path: 'artifacts/night-proposal.png', fullPage: true, animations: 'disabled' });
    await page.locator('#proposal-accept').click();
    await expect.poll(async () => (await stored()).generatedItems.length).toBe(1);
    const after = await stored();
    expect(after.candidates.some(girl => girl.name === '纸灯')).toBe(true);
    expect(after.customMonsters.some(monster => monster.name === '纸月')).toBe(true);
    expect(after.missions.some(mission => mission.title === '窗上的纸月亮' && mission.reward >= 1200 && mission.duration === 75)).toBe(true);
    expect(after.missions.some(mission => mission.envoy && mission.title === '替协会送一盏灯')).toBe(true);
    expect(after.opinions.some(opinion => opinion.title === '窗边的空位' && opinion.dialogue?.length === 3)).toBe(true);
    await page.unroute('**/chat/completions');
    await page.evaluate(() => { localStorage.removeItem('night-sugar:llm-config'); localStorage.removeItem('night-sugar:llm-auto'); });
    await page.reload({ waitUntil: 'networkidle' });
  });
  await check('契约卡导出并在新游戏中导入', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#girl-export-card').click()]);
    const cardPath = await download.path();
    expect(download.suggestedFilename()).toContain('契约卡-月见桃');
    const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
    expect(card.format).toBe('night-sugar/girl-card');
    expect(card.girl.name).toBe('月见桃');
    expect(card.girl.factionTag).toBe('association');
    await close();
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-market').click();
    const before = (await stored()).candidates.length;
    await page.setInputFiles('#market-card-file', cardPath);
    await expect.poll(async () => (await stored()).candidates.some(g => g.name === '月见桃')).toBe(true);
    expect((await stored()).candidates.length).toBe(before + 1);
    // 出身跟着卡片走：导入一位别的势力的少女，导入后不该被重新分配。
    expect((await stored()).candidates.find(g => g.name === '月见桃').factionTag).toBe(card.girl.factionTag);
    await page.setInputFiles('#market-card-file', cardPath);
    await expect(page.locator('[role="status"]')).toContainText('已经导入过');
    expect((await stored()).candidates.length).toBe(before + 1);
    await page.screenshot({ path: 'artifacts/card-import.png', animations: 'disabled' });
  });
  await check('自定义特性契约卡：带定义能还原，旧卡跳过特性而不整卡失败', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-market').click();
    const element = (await stored()).girls[0].element;
    const base = {
      format: 'night-sugar/girl-card', version: 1, exportedAt: new Date().toISOString(), sourceDay: 1,
      girl: {
        name: '宵坂 灯里', codename: 'C-9', title: '替夜巡街的人', element, color: '#b39ddb',
        goal: '把整条街的灯都点一遍。', appearance: '短发，袖口有焦痕。', personality: '话不多。', outfitDescription: '改过的值夜制服。',
        level: 2, stats: { magic: 62, insight: 64, agility: 58, empathy: 76 }, skillIds: ['glimmer-spear', 'night-prayer', 'moon-phase'],
        traitIds: ['custom-trait-abc123'],
        traits: [{ id: 'custom-trait-abc123', name: '夜里不睡', polarity: 'neutral', tags: ['自定义'], description: '越晚越清醒。' }],
        expression: 'calm',
      },
    };
    fs.writeFileSync('artifacts/custom-trait-card.json', JSON.stringify(base));
    await page.setInputFiles('#market-card-file', 'artifacts/custom-trait-card.json');
    await expect.poll(async () => (await stored()).candidates.some(g => g.name === '宵坂 灯里')).toBe(true);
    const brought = (await stored()).candidates.find(g => g.name === '宵坂 灯里');
    expect(brought.traits.map(trait => trait.name)).toEqual(['夜里不睡']);
    expect(brought.traits[0].tags).toEqual(['自定义']);
    const legacy = { ...base, girl: { ...base.girl, name: '宵坂 灯里 旧卡', traitIds: ['custom-trait-abc123', 'cat-sense'], traits: undefined } };
    fs.writeFileSync('artifacts/custom-trait-card-legacy.json', JSON.stringify(legacy));
    await page.setInputFiles('#market-card-file', 'artifacts/custom-trait-card-legacy.json');
    await expect.poll(async () => (await stored()).candidates.some(g => g.name === '宵坂 灯里 旧卡')).toBe(true);
    const old = (await stored()).candidates.find(g => g.name === '宵坂 灯里 旧卡');
    expect(old.traits.map(trait => trait.name)).toEqual(['猫缘']);
    await expect(page.locator('[role="status"]')).toContainText('没能随卡片带来');
  });
  await check('存档导出、导入与损坏文件拒绝', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#advance-time-30').click();
    const before = await stored();
    await page.locator('#open-settings').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#settings-export-save').click()]);
    const savePath = await download.path();
    const exported = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    expect(exported.day).toBe(before.day);
    expect(exported.girls.length).toBe(before.girls.length);
    await close();
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-settings').click();
    await page.setInputFiles('#settings-import-save-file', savePath);
    await expect(page.locator('#import-save-confirm')).toBeVisible();
    await page.locator('#import-save-confirm').click();
    await expect.poll(async () => (await stored()).day).toBe(before.day);
    await page.locator('#open-settings').click();
    await page.setInputFiles('#settings-import-save-file', { name: '坏存档.json', mimeType: 'application/json', buffer: Buffer.from('{"version":6,"girls":[]}') });
    await expect(page.locator('[role="status"]')).toContainText('导入失败');
    await expect(page.locator('#import-save-confirm')).toHaveCount(0);
    await page.screenshot({ path: 'artifacts/save-import.png', animations: 'disabled' });
  });
  await check('地图九辖区：地形边界、区域面板与环境影响', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.district-shape')).toHaveCount(9);
    await page.locator('.district-shape .district-fill').first().dispatchEvent('click');
    await expect(page.locator('.district-panel')).toBeVisible();
    await expect(page.locator('.district-panel .district-effect').first()).toBeVisible();
    await page.screenshot({ path: 'artifacts/districts.png', animations: 'disabled' });
    await page.locator('#district-panel-close').click();
    await expect(page.locator('.district-panel')).toHaveCount(0);
  });
  await check('事务所终端：CMD 按钮可查询状态、辖区并推进时间', async () => {
    await page.locator('#open-command').click();
    await expect(page.locator('#cmd-input')).toBeVisible();
    await page.locator('#cmd-input').fill('status');
    await page.locator('#cmd-input').press('Enter');
    await expect(page.locator('#cmd-output')).toContainText('第 14 日');
    await expect(page.locator('#cmd-output')).toContainText('距打烊');
    await page.locator('#cmd-input').fill('district candy');
    await page.locator('#cmd-input').press('Enter');
    await expect(page.locator('#cmd-output')).toContainText('糖果公园');
    const beforeMinutes = (await stored()).minutes;
    await page.locator('#cmd-input').fill('advance 30');
    await page.locator('#cmd-input').press('Enter');
    await expect.poll(async () => (await stored()).minutes).toBe(beforeMinutes + 30);
    await page.screenshot({ path: 'artifacts/command-console.png', animations: 'disabled' });
    await page.locator('#cmd-input').press('Escape');
    await expect(page.locator('#cmd-input')).toHaveCount(0);
    await page.keyboard.press('Control+K');
    await expect(page.locator('#cmd-input')).toBeVisible();
    await page.locator('#cmd-close').click();
    await expect(page.locator('#cmd-input')).toHaveCount(0);
  });
  await check('打烊交接：二次确认后进入下一天 20:00 并放出第一批委托', async () => {
    await page.locator('#end-night').click();
    await expect(page.locator('#end-night-confirm')).toBeVisible();
    await page.locator('#end-night-confirm').click();
    await expect.poll(async () => (await stored()).day).toBe(15);
    const s = await stored();
    expect(s.minutes).toBe(20 * 60);
    expect(s.shift.wave).toBe(1);
    expect(s.missions.some(m => m.id.startsWith('c-15-0-'))).toBe(true);
    await expect(page.locator('.shift-clock')).toContainText('第 15 日');
  });
  await check('叙事引擎控制台可折叠，预设可导入 SillyTavern 对话补全预设', async () => {
    await page.locator('#llm-console-toggle').click();
    await expect(page.locator('#llm-filter-failed')).toBeVisible();
    await expect(page.locator('.llm-console-tip')).toContainText('保留最近 40 次');
    const beforeBox = await page.locator('.llm-console').boundingBox();
    const handle = await page.locator('#llm-console-resize').boundingBox();
    await page.mouse.move(handle.x + 6, handle.y + 6);
    await page.mouse.down();
    await page.mouse.move(handle.x - 90, handle.y - 70, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await page.locator('.llm-console').boundingBox()).width).toBeGreaterThan(beforeBox.width + 40);
    await expect.poll(async () => (await page.locator('.llm-console').boundingBox()).height).toBeGreaterThan(beforeBox.height + 30);
    const savedSize = await page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:llm-console-size') ?? 'null'));
    expect(savedSize.w).toBeGreaterThan(beforeBox.width);
    await page.locator('#llm-console-toggle').click();
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await expect(page.locator('#preset-item-builtin-balanced')).toBeVisible();
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]').length);
    await page.locator('#preset-import-paste').fill(JSON.stringify({ name: '浏览器预设', temp_openai: 0.5, top_p_openai: 0.9, main: '保持短句', wi_format: '[WI]', extensions: { SPreset: {} }, prompts: [{ identifier: 'tool', content: '调用 game_content 输出。' }] }));
    await page.locator('#preset-import-paste-run').click();
    await expect(page.locator('.preset-report.ok')).toContainText('已导入');
    await expect(page.locator('.preset-report.ok')).toContainText('wi_format');
    await expect(page.locator('.preset-notes')).toContainText('SPreset');
    await expect(page.locator('.preset-unsupported')).toContainText('game_content');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]').length)).toBeGreaterThan(before);
    await page.screenshot({ path: 'artifacts/presets.png', animations: 'disabled' });
    await close();
  });
  await check('预设词条可增删排序，并绑定给剧情引擎', async () => {
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await page.locator('#preset-item-builtin-balanced').click();
    await page.locator('#preset-duplicate').click();
    await page.locator('#preset-tab-prompts').click();
    await expect(page.locator('.preset-entry')).toHaveCount(13);
    await page.locator('#preset-entry-add').click();
    await expect(page.locator('.preset-entry')).toHaveCount(14);
    await page.locator('#preset-entry-content-13').fill('{{player}} 这一句会引用玩家档案。');
    await page.locator('#preset-entry-enabled-0').click();
    await expect(page.locator('#preset-entry-enabled-0')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#preset-entry-up-13').click();
    await expect(page.locator('#preset-entry-content-12')).toHaveValue(/玩家档案/);
    await expect(page.locator('.preset-token-total')).toContainText('tokens');
    await page.locator('#preset-task-tab-arc').click();
    await expect(page.locator('#preset-bind-current')).toHaveValue(/preset-/);
    const arcBefore = await page.locator('#preset-bind-current').inputValue();
    await page.locator('#preset-bind-current').selectOption({ label: '均衡叙事 副本' });
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:preset-binding') ?? '{}').arc)).toContain('preset-');
    await page.locator('#preset-task-tab-storyline').click();
    await expect(page.locator('#preset-bind-current')).not.toHaveValue(arcBefore);
    await page.locator('#preset-task-tab-all').click();
    await page.locator('.preset-list button', { hasText: '均衡叙事 副本' }).click();
    await page.screenshot({ path: 'artifacts/preset-entries.png', animations: 'disabled' });
    await page.locator('#preset-tab-advanced').click();
    await page.locator('#preset-api-endpoint').fill('https://api.example.invalid/v1');
    await page.locator('#preset-api-model').fill('story-local');
    await page.locator('#preset-regex-add').click();
    await page.locator('#preset-regex-name-0').fill('去掉旁白括号');
    await page.locator('#preset-regex-find-0').fill('/（[^）]*）/g');
    await page.locator('#preset-regex-replace-0').fill('');
    await page.locator('#preset-regex-input-0').check();
    await page.locator('#preset-format-scenario').fill('【场景】\n{0}');
    await page.locator('#preset-api-provider-vertex').click();
    await page.locator('#preset-api-location').fill('asia-east1');
    await expect(page.locator('#preset-api-provider-vertex')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#preset-api-endpoint')).toHaveCount(0);
    await expect.poll(async () => page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]');
      const item = list.find(preset => preset.name === '均衡叙事 副本');
      return item?.api?.provider ?? '';
    })).toBe('vertex');
    await page.screenshot({ path: 'artifacts/preset-api-vertex.png', animations: 'disabled' });
    await page.locator('#preset-api-provider-default').click();
    await expect(page.locator('#preset-api-endpoint')).toHaveCount(1);
    await expect.poll(async () => page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]');
      const item = list.find(preset => preset.name === '均衡叙事 副本');
      return item?.api?.provider ?? 'none';
    })).toBe('none');
    await expect.poll(async () => page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]');
      const item = list.find(preset => preset.name === '均衡叙事 副本');
      return item?.api?.model ?? '';
    })).toBe('story-local');
    await expect.poll(async () => page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]');
      const item = list.find(preset => preset.name === '均衡叙事 副本');
      return item?.regex?.[0]?.targets?.join(',') ?? '';
    })).toBe('output,input');
    await page.screenshot({ path: 'artifacts/preset-advanced.png', animations: 'disabled' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await page.locator('.preset-list button', { hasText: '均衡叙事 副本' }).click();
    await page.locator('#preset-tab-advanced').click();
    await expect(page.locator('#preset-api-model')).toHaveValue('story-local');
    await expect(page.locator('#preset-regex-name-0')).toHaveValue('去掉旁白括号');
    await expect(page.locator('#preset-format-scenario')).toHaveValue('【场景】\n{0}');
    await page.locator('#modal-close').click();
  });
  await check('旧版预设（无词条）导入后自动迁移出 main 词条', async () => {
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await page.locator('#preset-import-paste').fill(JSON.stringify({ name: '旧版预设', temperature: 0.66, main: '旧版主体：先描述环境，再给对白。' }));
    await page.locator('#preset-import-paste-run').click();
    await expect(page.locator('.preset-report.ok')).toContainText('已导入');
    await page.locator('.preset-list button', { hasText: '旧版预设' }).click();
    await page.locator('#preset-tab-prompts').click();
    await expect(page.locator('.preset-entry')).toHaveCount(14);
    await expect(page.locator('#preset-entry-content-0')).toHaveValue(/旧版主体/);
    await page.locator('#modal-close').click();
  });

  await check('任务提示词按用途编辑，并标出旧数值禁令', async () => {
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await expect(page.locator('#settings-prompt-battle')).toBeVisible();
    await page.locator('#settings-prompt-battle').click();
    await expect(page.locator('#preset-task-tab-battle')).toHaveClass(/active/);
    await expect(page.locator('#preset-name')).toHaveValue('战斗札记');
    await expect(page.locator('#preset-bind-current')).toHaveValue(/preset-/);
    await page.locator('#modal-close').click();
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-prompt-daily').click();
    await expect(page.locator('.preset-task-tabs button')).toHaveCount(11);
    await expect(page.locator('.preset-list')).toHaveCount(0);
    await expect(page.locator('#preset-task-tab-daily')).toHaveClass(/active/);
    await expect(page.locator('#preset-tab-prompts')).toHaveClass(/active/);
    await expect(page.locator('#preset-name')).toHaveValue('每日提案');
    await expect(page.locator('#preset-bind-current')).toHaveValue(/preset-/);
    const dailyBound = await page.locator('#preset-bind-current').inputValue();
    await page.locator('#preset-task-tab-profile').click();
    await expect(page.locator('#preset-bind-current')).toHaveValue(/preset-/);
    await expect(page.locator('#preset-bind-current')).not.toHaveValue(dailyBound);
    await page.locator('#preset-task-tab-daily').click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:preset-binding') ?? '{}').daily)).toContain('preset-');
    await expect(page.locator('.preset-entry')).toHaveCount(1);
    await expect(page.locator('.preset-entry textarea')).toHaveValue(/为今晚的夜班提案/);
    await page.locator('#modal-close').click();

    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await page.locator('.preset-list button', { hasText: '均衡叙事 副本' }).click();
    await page.locator('#preset-tab-prompts').click();
    const dailyIndex = await page.evaluate(() => [...document.querySelectorAll('.preset-entry')]
      .findIndex(item => (item.querySelector('select[id^="preset-entry-scope-"]'))?.value === 'daily'));
    expect(dailyIndex).toBeGreaterThanOrEqual(0);
    const dailyEntry = page.locator('.preset-entry').nth(dailyIndex);
    await dailyEntry.locator('textarea').fill('为今晚提交一份提案。只描述名字与外观，不要给任何数值、奖励或规则。');
    await expect(dailyEntry.locator('.preset-entry-warning')).toContainText('完整生成冲突');
    await dailyEntry.locator('[id^="preset-entry-fix-ban-"]').click();
    await expect(dailyEntry.locator('.preset-entry-warning')).toHaveCount(0);
    await expect(dailyEntry.locator('textarea')).not.toHaveValue(/任何数值/);
    await page.screenshot({ path: 'artifacts/preset-scopes.png', animations: 'disabled' });
    await page.locator('#modal-close').click();
  });

  await check('双接口凭证：两份并存，切换默认不覆盖另一份', async () => {
    const serviceAccount = JSON.stringify({
      type: 'service_account',
      project_id: 'night-sugar-demo',
      client_email: 'svc@night-sugar-demo.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nMIIBVAIBADANBgkq\\n-----END PRIVATE KEY-----\\n',
      token_uri: 'https://oauth2.googleapis.com/token',
    });
    await page.evaluate((sa) => localStorage.setItem('night-sugar:llm-config', JSON.stringify({
      provider: 'openai',
      openai: { endpoint: 'https://api.deepseek.com/v1', apiKey: 'sk-openai-demo', model: 'deepseek-chat', location: 'us-central1' },
      vertex: { endpoint: '', apiKey: sa, model: 'gemini-2.5-pro', location: 'asia-east1' },
    })), serviceAccount);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await expect(page.locator('#settings-llm-provider-openai')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.llm-default-item').nth(0)).toContainText('deepseek-chat');
    await expect(page.locator('.llm-default-item').nth(1)).toContainText('night-sugar-demo');
    await expect(page.locator('.llm-default-item').nth(1)).not.toContainText('默认');
    await page.locator('#settings-llm-provider-vertex').click();
    await expect(page.locator('#settings-llm-provider-vertex')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.llm-default-item').nth(1)).toContainText('默认');
    await expect(page.locator('#settings-llm-credential')).toBeVisible();
    // 切过去之后两份都还在：OpenAI 那份不能被 Vertex 的值抄掉。
    await expect(page.locator('.llm-default-item').nth(0)).toContainText('deepseek-chat');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:llm-config') ?? '{}'));
    expect(saved.provider).toBe('vertex');
    expect(saved.openai.apiKey).toBe('sk-openai-demo');
    expect(saved.openai.model).toBe('deepseek-chat');
    expect(saved.vertex.apiKey.startsWith('{')).toBe(true);
    expect(saved.vertex.model).toBe('gemini-2.5-pro');
    await page.screenshot({ path: 'artifacts/settings-dual-slot.png', animations: 'disabled' });
    await page.locator('#modal-close').click();
    await page.evaluate(() => localStorage.removeItem('night-sugar:llm-config'));
    await page.reload({ waitUntil: 'networkidle' });
  });

  await check('设置：Vertex AI 接受服务账号 JSON 导入并预览端点', async () => {
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await expect(page.locator('#settings-llm-endpoint')).toBeVisible();
    await page.locator('#settings-llm-provider-vertex').click();
    await expect(page.locator('#settings-llm-json')).toBeVisible();
    await expect(page.locator('#settings-llm-endpoint')).toHaveCount(0);
    await expect(page.locator('#settings-llm-key')).toHaveCount(0);
    const serviceAccount = JSON.stringify({
      type: 'service_account',
      project_id: 'night-sugar-demo',
      client_email: 'svc@night-sugar-demo.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nMIIBVAIBADANBgkq\\n-----END PRIVATE KEY-----\\n',
      token_uri: 'https://oauth2.googleapis.com/token',
    });
    await page.setInputFiles('#settings-llm-import', { name: 'night-sugar-demo.json', mimeType: 'application/json', buffer: Buffer.from(serviceAccount) });
    await expect(page.locator('#settings-llm-vertex-info')).toContainText('night-sugar-demo');
    // 导入后私钥收起：只留遮住正文的摘要，界面上不应再出现邮箱明文。
    await expect(page.locator('#settings-llm-credential')).toBeVisible();
    await expect(page.locator('#settings-llm-json')).toBeHidden();
    await expect(page.locator('#settings-llm-project')).toHaveText('night-sugar-demo');
    await expect(page.locator('#settings-llm-account')).toContainText('••••');
    await expect(page.locator('#settings-llm-account')).not.toContainText('svc@night-sugar-demo.iam.gserviceaccount.com');
    expect(await page.evaluate(() => document.body.innerText.includes('BEGIN PRIVATE KEY'))).toBe(false);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:llm-config') ?? '{}'));
    expect(saved.provider).toBe('vertex');
    expect(saved.vertex.apiKey.includes('svc@night-sugar-demo.iam.gserviceaccount.com')).toBe(true);
    expect(saved.openai.apiKey).toBe('');
    await page.locator('#settings-llm-model').fill('gemini-2.5-pro');
    await page.locator('#settings-llm-location').fill('asia-east1');
    const endpointPreview = page.locator('#settings-llm-model + small');
    await expect(endpointPreview).toContainText('asia-east1-aiplatform.googleapis.com');
    await expect(endpointPreview).toContainText('/projects/night-sugar-demo/locations/asia-east1/publishers/google/models/gemini-2.5-pro:generateContent');
    await page.screenshot({ path: 'artifacts/settings-vertex.png', animations: 'disabled' });
    // 更换密钥重新打开输入框，填完点「使用」才落盘；取消则原密钥原样保留。
    await page.locator('#settings-llm-replace').click();
    await expect(page.locator('#settings-llm-json')).toBeVisible();
    await expect(page.locator('#settings-llm-credential')).toHaveCount(0);
    await page.locator('#settings-llm-json').fill('AIzaSy-demo-express-key');
    await page.locator('#settings-llm-use').click();
    await expect(page.locator('#settings-llm-vertex-info')).toContainText('Express');
    await expect(page.locator('#settings-llm-account')).toContainText('AIza');
    await expect(page.locator('#settings-llm-account')).not.toContainText('demo-express');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:llm-config') ?? '{}').vertex.apiKey)).toBe('AIzaSy-demo-express-key');
    await page.locator('#modal-close').click();
    await page.evaluate(() => localStorage.removeItem('night-sugar:llm-config'));
  });

  await check('正则预览区分发给模型与界面显示', async () => {
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await page.locator('.preset-list button', { hasText: '均衡叙事 副本' }).click();
    await page.locator('#preset-tab-advanced').click();
    await page.locator('#preset-regex-add').click();
    await page.locator('#preset-regex-name-1').fill('仅显示改名');
    await page.locator('#preset-regex-find-1').fill('剧情');
    await page.locator('#preset-regex-replace-1').fill('故事');
    await page.locator('#preset-regex-display-only-1').check();
    await page.locator('#preset-regex-sample').fill('（她把杯子放下）这一晚的剧情到这里就结束了。');
    await expect(page.locator('#preset-regex-preview-prompt')).toContainText('这一晚的剧情');
    await expect(page.locator('#preset-regex-preview-prompt')).not.toContainText('（她把杯子放下）');
    await expect(page.locator('#preset-regex-preview-display')).toContainText('这一晚的故事');
    await page.screenshot({ path: 'artifacts/preset-regex-preview.png', animations: 'disabled' });
    await page.locator('#modal-close').click();
  });

  await check('导出预设带 schema 4 与用途且剥离密钥', async () => {
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await page.locator('.preset-list button', { hasText: '均衡叙事 副本' }).click();
    await page.locator('#preset-tab-advanced').click();
    await page.locator('#preset-api-key').fill('sk-secret-test');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#preset-export').click(),
    ]);
    const file = await download.path();
    const exported = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(exported);
    expect(parsed.schema).toBe(4);
    expect(exported.includes('sk-secret-test')).toBe(false);
    expect(parsed.prompts.some(entry => entry.scope === 'daily')).toBe(true);
    expect(parsed.prompts.some(entry => entry.scope === 'battle')).toBe(true);
    expect(Array.isArray(parsed.extensions?.regex_scripts)).toBe(true);
    await page.locator('#modal-close').click();
  });

  await check('旧版世界观与每日要求会迁移成可编辑预设', async () => {
    await page.evaluate(() => {
      localStorage.setItem('night-sugar:llm-prompts', JSON.stringify({ world: '旧世界：霓虹灯下的樱雾市，夜班永不结束。', daily: '为今晚写一份只谈气氛的提案，不要给任何数值。' }));
      localStorage.removeItem('night-sugar:presets');
      localStorage.removeItem('night-sugar:llm-prompts-migrated');
      localStorage.removeItem('night-sugar:preset-binding');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await page.locator('#settings-open-presets').click();
    await page.locator('.preset-list button', { hasText: '迁移的旧提示词' }).click();
    await page.locator('#preset-tab-prompts').click();
    await expect(page.locator('.preset-entry textarea').first()).toHaveValue(/霓虹灯下的樱雾市/);
    await expect(page.locator('#preset-entry-content-5')).toHaveValue(/只谈气氛/);
    await page.screenshot({ path: 'artifacts/preset-legacy-migration.png', animations: 'disabled' });
    await page.locator('#modal-close').click();
    await page.evaluate(() => {
      localStorage.removeItem('night-sugar:llm-prompts');
      localStorage.removeItem('night-sugar:presets');
      localStorage.removeItem('night-sugar:llm-prompts-migrated');
      localStorage.removeItem('night-sugar:preset-binding');
    });
    await page.reload({ waitUntil: 'networkidle' });
  });

  await check('玩家档案写入后可在刷新后保留', async () => {
    await page.locator('#open-settings').click();
    await page.locator('#settings-player-name').fill('白鸟');
    await page.locator('#settings-player-alias').fill('所长');
    await page.locator('#settings-player-appearance').fill('总是穿着旧风衣，左手戴一只停摆的表。');
    await page.locator('#settings-player-background').fill('三年前签下这间事务所，再没离开过这条街。');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:player-profile') ?? '{}').name)).toBe('白鸟');
    await page.screenshot({ path: 'artifacts/player-profile.png', animations: 'disabled' });
    await page.locator('#modal-close').click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-settings').click();
    await expect(page.locator('#settings-player-name')).toHaveValue('白鸟');
    await page.locator('#modal-close').click();
  });
  await check('输出预算：统一值管住全部任务，单项可覆盖并在刷新后保留', async () => {
    await page.evaluate(() => localStorage.removeItem('night-sugar:llm-budget'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await expect(page.locator('#settings-budget-unified')).toHaveValue('2048');
    await expect(page.locator('#settings-budget-task-daily')).toHaveValue('6000');
    await expect(page.locator('#settings-budget-task-chat')).toHaveValue('');
    await page.locator('#settings-budget-unified').fill('1200');
    await page.locator('#settings-budget-task-chat').fill('900');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:llm-budget') ?? '{}').unified)).toBe(1200);
    await page.screenshot({ path: 'artifacts/settings-budget.png', animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 900 });
    await layout('settings budget 390');
    await page.screenshot({ path: 'artifacts/settings-budget-390.png', animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 900 });
    await layout('settings budget 320');
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.locator('#modal-close').click();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-settings').click();
    await page.locator('#settings-tab-llm').click();
    await expect(page.locator('#settings-budget-unified')).toHaveValue('1200');
    await expect(page.locator('#settings-budget-task-chat')).toHaveValue('900');
    await expect(page.locator('#settings-budget-task-storyline')).toHaveValue('3000');
    await page.locator('#settings-budget-task-daily').fill('');
    await expect(page.locator('.llm-budget-tasks li').nth(1)).toContainText('跟随统一值');
    await page.locator('#settings-budget-reset').click();
    await expect(page.locator('#settings-budget-unified')).toHaveValue('2048');
    await page.locator('#modal-close').click();
    await page.evaluate(() => localStorage.removeItem('night-sugar:llm-budget'));
    await page.reload({ waitUntil: 'networkidle' });
  });

  await check('衣柜导入：去背景预览、逐套编辑与移出', async () => {
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-wardrobe-manage').click();
    await page.setInputFiles('#wardrobe-file-input', 'artifacts/fixture-portrait.png');
    await expect(page.locator('.wardrobe-stage')).toHaveCount(1);
    await page.locator('#wardrobe-stage-name-0').fill('测试礼装');
    await page.locator('#wardrobe-stage-cut-0').click();
    await expect(page.locator('.cutout-preview')).toBeVisible();
    await page.locator('#cutout-apply').click();
    await expect(page.locator('.wardrobe-stage-thumb img')).toHaveAttribute('src', /^data:image\/png/);
    await page.locator('#wardrobe-stage-remove-0').click();
    await expect(page.locator('.wardrobe-stage')).toHaveCount(0);
    await page.screenshot({ path: 'artifacts/wardrobe-stage.png', animations: 'disabled' });
    await page.locator('#wardrobe-import-close').click();
    await close();
  });
  await check('衣柜中的服装可以删除', async () => {
    const before = (await stored()).girls.find(g => g.id === 'yue').wardrobe.length;
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-wardrobe-manage').click();
    await page.locator('[id^="wardrobe-remove-"]').first().click();
    await expect.poll(async () => (await stored()).girls.find(g => g.id === 'yue').wardrobe.length).toBe(before - 1);
    await page.locator('#wardrobe-import-close').click();
    await close();
  });
  await check('魔法少女详情页导入衣柜并占满四格', async () => {
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-wardrobe-import').click();
    await expect(page.locator('#wardrobe-paste')).toBeVisible();
    await page.locator('#wardrobe-paste').fill(JSON.stringify([
      { name: '莓色礼装', description: '樱色的短披肩。', palette: ['#e8a7c2'], layerKey: 'formal' },
      { name: '雨夜斗篷', description: '带盐味的深蓝。', palette: ['#5a7fa8'], layerKey: 'casual' },
    ]));
    await page.locator('#wardrobe-paste-run').click();
    await expect(page.locator('#wardrobe-import-confirm')).toBeEnabled();
    await page.locator('#wardrobe-import-confirm').click();
    await expect.poll(async () => (await stored()).girls.find(g => g.id === 'yue').wardrobe.length).toBe(4);
    const names = (await stored()).girls.find(g => g.id === 'yue').wardrobe.map(item => item.name);
    expect(names).toContain('莓色礼装');
    await page.screenshot({ path: 'artifacts/wardrobe-import.png', animations: 'disabled' });
    await close();
    await close();
  });
  await check('世界书：编辑词条、命中预览、数值规则持久化', async () => {
    await page.locator('#open-worldbook').click();
    await expect(page.locator('.worldbook-view')).toBeVisible();
    await expect(page.locator('#worldbook-entry-wound')).toBeVisible();
    await page.locator('#worldbook-entry-clinic').click();
    const stamp = `治疗按小时恢复。改于${Date.now() % 100000}`;
    await page.locator('#worldbook-content').fill(stamp);
    await page.locator('#worldbook-trigger').fill('她需要去诊所治疗');
    await expect(page.locator('.wb-hit', { hasText: '诊所' })).toHaveCount(1);
    await page.screenshot({ path: 'artifacts/worldbook-entries.png', fullPage: true, animations: 'disabled' });
    await page.locator('#worldbook-new').click();
    await expect(page.locator('.wb-item')).toHaveCount(16);
    await expect.poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:worldbook') ?? '[]')).length).toBe(16);
    await page.locator('#worldbook-tab-balance').click();
    await page.locator('#balance-clinicBase').fill('150');
    await expect.poll(async () => JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:balance') ?? '{}')).clinicBase).toBe(150);
    await page.screenshot({ path: 'artifacts/worldbook.png', fullPage: true, animations: 'disabled' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-worldbook').click();
    await expect(page.locator('.worldbook-view')).toBeVisible();
    await page.locator('#worldbook-entry-clinic').click();
    await expect(page.locator('#worldbook-content')).toHaveValue(stamp);
    await page.locator('#worldbook-tab-balance').click();
    await expect(page.locator('#balance-clinicBase')).toHaveValue('150');
    await page.locator('#nav-dispatch').click();
  });
  await check('内容工坊：新建技能、装备、魔物与委托，规则与档案在刷新后保留', async () => {
    await page.locator('#open-workshop').click();
    await expect(page.locator('.workshop-shell')).toBeVisible();
    await page.locator('#workshop-tab-skill').click();
    await page.locator('#workshop-new').click();
    await page.locator('#workshop-name').fill('测试·夜光针');
    await page.locator('#workshop-add-effect').click();
    await page.locator('#workshop-effect-filter-0').selectOption('offense');
    await expect(page.locator('#workshop-effect-preset-0 option')).toHaveCount(5);
    await page.locator('#workshop-effect-preset-0').selectOption('power-surge');
    await expect(page.locator('#workshop-effect-kind-0')).toHaveValue('buff');
    await expect(page.locator('#workshop-effect-stat-0')).toHaveValue('magic');
    await expect(page.locator('#workshop-effect-amount-0')).toHaveValue('12');
    await page.locator('#workshop-effect-amount-0').fill('3');
    await page.locator('#workshop-save').click();
    const afterSkill = JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:content:v1')));
    expect(afterSkill.skills.length).toBe(1);
    const skillId = afterSkill.skills[0].id;
    expect(afterSkill.skills[0].effects[0].amount).toBe(3);
    expect(afterSkill.skills[0].effects[0].preset).toBe('power-surge');
    expect(afterSkill.skills[0].effects[0].label).toBe('锋芒增幅');
    expect(afterSkill.skills[0].effects[0].category).toBe('offense');
    await page.locator('#workshop-tab-item').click();
    await page.locator('#workshop-new').click();
    await page.locator('#workshop-name').fill('测试·夜行护符');
    await page.locator('#workshop-price').fill('880');
    await page.locator('#workshop-stat-magic').fill('2');
    await page.locator('#workshop-damage-bonus').fill('40');
    await page.locator('#workshop-initiative-bonus').fill('8');
    await page.locator('#workshop-save').click();
    const afterItem = JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:content:v1')));
    expect(afterItem.items.length).toBe(1);
    expect(afterItem.items[0].damageBonus).toBe(40);
    expect(afterItem.items[0].initiativeBonus).toBe(8);
    const itemId = afterItem.items[0].id;
    await page.locator('#workshop-tab-monster').click();
    await page.locator('#workshop-new').click();
    await page.locator('#workshop-name').fill('测试·夜斑蝶');
    await page.locator('#workshop-hp').fill('260');
    await expect(page.locator('#workshop-monster-skill-0')).toBeVisible();
    const allSkillOptions = await page.locator('#workshop-monster-skill-0 option').count();
    await page.locator('#workshop-monster-skill-filter-0').selectOption('奥义');
    const ultimateSkillOptions = await page.locator('#workshop-monster-skill-0 option').count();
    expect(ultimateSkillOptions).toBeLessThan(allSkillOptions);
    await page.locator('#workshop-monster-skill-filter-0').selectOption('');
    await page.locator('#workshop-add-monster-skill').click();
    await expect(page.locator('#workshop-monster-skill-1')).toBeVisible();
    await page.locator('#workshop-monster-skill-remove-1').click();
    await expect(page.locator('#workshop-monster-skill-1')).toHaveCount(0);
    await page.locator('#workshop-add-rule').click();
    await page.locator('#workshop-rule-effect-0').selectOption('damageReduce');
    await page.locator('#workshop-rule-amount-0').fill('25');
    await page.locator('#workshop-tab-preview').click();
    await expect(page.locator('#workshop-preview')).toContainText('减免 25%');
    await page.locator('#workshop-tab-form').click();
    await page.locator('#workshop-save').click();
    const afterMonster = JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:content:v1')));
    expect(afterMonster.monsters.length).toBe(1);
    const monsterId = afterMonster.monsters[0].id;
    expect(afterMonster.monsters[0].rules[0].effect).toBe('damageReduce');
    await page.locator('#workshop-tab-investigation').click();
    await page.locator('#workshop-new').click();
    await page.locator('#workshop-mission-title').fill('测试·夜巡调查');
    await page.locator('#workshop-mission-category').fill('试作');
    await page.locator('#workshop-mission-duration').fill('60');
    await page.locator('#workshop-mission-requirement').selectOption('empathy');
    await page.locator('#workshop-mission-target').fill('50');
    await page.locator('#workshop-mission-reward').fill('700');
    await page.locator('#workshop-mission-reward-item').selectOption(itemId);
    await page.locator('#workshop-mission-reward-girl').fill('1');
    await page.locator('#workshop-save').click();
    const afterInvestigation = JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:content:v1')));
    expect(afterInvestigation.missions.length).toBe(1);
    const investigation = afterInvestigation.missions.find(entry => entry.work === 'investigation');
    expect(investigation.work).toBe('investigation');
    expect(investigation.rewardEquipmentId).toBe(itemId);
    expect(investigation.rewardGirlLevel).toBe(1);
    await page.locator('#workshop-tab-combat').click();
    await page.locator('#workshop-new').click();
    await expect(page.locator('#workshop-mission-target')).toHaveCount(0);
    await page.locator('#workshop-mission-title').fill('测试·夜航委托');
    await page.locator('#workshop-mission-category').fill('试作');
    await page.locator('#workshop-mission-duration').fill('75');
    await page.locator('#workshop-mission-requirement').selectOption('empathy');
    await expect(page.locator('#workshop-mission-enemy-0')).toBeVisible();
    await page.locator('#workshop-mission-enemy-filter-0').selectOption('游荡');
    await expect(page.locator('#workshop-mission-enemy-0 option')).toHaveCount(2);
    await page.locator('#workshop-mission-enemy-filter-0').selectOption('');
    await page.locator('#workshop-mission-enemy-0').selectOption('night-tram');
    await page.locator('#workshop-add-mission-enemy').click();
    await expect(page.locator('#workshop-mission-enemy-1')).toBeVisible();
    await page.locator('#workshop-mission-enemy-remove-1').click();
    await expect(page.locator('#workshop-mission-enemy-1')).toHaveCount(0);
    await page.locator('#workshop-mission-reward').fill('900');
    await page.locator('#workshop-mission-district').selectOption('candy');
    await page.locator('#workshop-mission-window').selectOption('long');
    await page.locator('#workshop-save').click();
    const afterMission = JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:content:v1')));
    expect(afterMission.missions.length).toBe(2);
    const combat = afterMission.missions.find(entry => entry.work === 'combat');
    const missionId = combat.id;
    expect(combat.work).toBe('combat');
    expect(combat.duration).toBe(75);
    expect(combat.enemyIds).toEqual(['night-tram']);
    await page.locator('#workshop-deploy').click();
    await expect(page.locator('.game-toast')).toContainText('已投放到今夜的地图');
    await page.screenshot({ path: 'artifacts/workshop.png', animations: 'disabled' });
    await layout('workshop');
    await page.locator('#workshop-tab-incident').click();
    await page.locator('#workshop-new').click();
    await page.locator('#workshop-incident-title').fill('测试·夜巡弹窗');
    await page.locator('#workshop-incident-body').fill('雨停之后，巷口站着一个不该出现的人。');
    await page.locator('#workshop-incident-kind').selectOption('faction');
    await page.locator('#workshop-incident-faction').selectOption('witch');
    await page.locator('#workshop-add-option').click();
    await page.locator('#workshop-incident-option-label-2').fill('把门关上');
    await page.locator('#workshop-incident-option-hint-2').fill('今晚不想再惹麻烦。');
    await page.locator('#workshop-incident-effect-faction-0').selectOption('witch');
    await page.locator('#workshop-incident-standing-0').fill('3');
    await page.locator('#workshop-incident-district-effect-0').selectOption('candy');
    await page.locator('#workshop-incident-days-0').fill('2');
    await page.locator('#workshop-incident-target-0').fill('9');
    await page.locator('#workshop-save').click();
    const afterIncident = JSON.parse(await page.evaluate(() => localStorage.getItem('night-sugar:content:v1')));
    expect(afterIncident.incidents.length).toBe(1);
    expect(afterIncident.incidents[0].options.length).toBe(3);
    const incidentId = afterIncident.incidents[0].id;
    await layout('workshop-incident');
    await page.locator('#workshop-deploy').click();
    await expect(page.locator('.incident-overlay')).toBeVisible();
    await expect(page.locator('.incident-card')).toContainText('测试·夜巡弹窗');
    await expect(page.locator('.incident-source')).toHaveText('工坊投放');
    await page.screenshot({ path: 'artifacts/workshop-incident.png', fullPage: true, animations: 'disabled' });
    await page.locator('#incident-option-opt-1').click();
    await expect(page.locator('.incident-overlay')).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-workshop').click();
    await page.locator('#workshop-tab-skill').click();
    await expect(page.locator(`#workshop-entry-${skillId}`)).toBeVisible();
    await page.locator('#workshop-tab-item').click();
    await expect(page.locator(`#workshop-entry-${itemId}`)).toBeVisible();
    await page.locator('#workshop-tab-monster').click();
    await expect(page.locator(`#workshop-entry-${monsterId}`)).toBeVisible();
    await page.locator('#workshop-tab-investigation').click();
    await expect(page.locator(`#workshop-entry-${investigation.id}`)).toBeVisible();
    await page.locator('#workshop-tab-combat').click();
    await expect(page.locator(`#workshop-entry-${missionId}`)).toBeVisible();
    await page.locator('#workshop-tab-incident').click();
    await expect(page.locator(`#workshop-entry-${incidentId}`)).toBeVisible();
    fs.mkdirSync('.tmp', { recursive: true });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#workshop-export').click(),
    ]);
    await download.saveAs('.tmp/content-pack.json');
    const pack = JSON.parse(fs.readFileSync('.tmp/content-pack.json', 'utf8'));
    expect(pack.format).toBe('night-sugar/content-library');
    expect(pack.skills.length).toBe(1);
    expect(pack.missions.length).toBe(2);
    expect(pack.incidents.length).toBe(1);
    await page.evaluate(() => localStorage.removeItem('night-sugar:content:v1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#open-workshop').click();
    await page.locator('#workshop-tab-skill').click();
    await expect(page.locator(`#workshop-entry-${skillId}`)).toHaveCount(0);
    await page.locator('#workshop-import-file').setInputFiles('.tmp/content-pack.json');
    await expect(page.locator('.game-toast')).toContainText('导入完成');
    await page.locator('#workshop-tab-skill').click();
    await expect(page.locator(`#workshop-entry-${skillId}`)).toBeVisible();
    await page.locator('#workshop-tab-incident').click();
    await expect(page.locator(`#workshop-entry-${incidentId}`)).toBeVisible();
    await page.locator('#workshop-close').click();
    await page.locator('#nav-dispatch').click();
  });
  await check('故事线会发布带目标的故事委托，完成后触发剧情事件', async () => {
    const before = await stored();
    const missionGirl = before.girls.find(g => g.id === 'yue');
    missionGirl.bond = 60;
    missionGirl.storyPlan = {
      title: '夜巡的蓝图', premise: '河岸上有一盏没有登记的灯。', tone: '克制', beats: [],
      graph: {
        version: 1, entry: 'start',
        nodes: [
          { id: 'start', kind: 'start', x: 60, y: 160, title: '开始', data: { kind: 'start' } },
          { id: 'scene-1', kind: 'scene', x: 292, y: 160, title: '河岸', data: { kind: 'scene', narration: '她沿着河岸走，灯影在水面上碎成几片。', lines: [], effects: [], choices: [] } },
          { id: 'beat-1', kind: 'mission', x: 524, y: 160, title: '这一夜的委托', data: { kind: 'mission', spec: { title: '夜巡河岸', goal: '沿着河岸找到那盏没有登记的灯。', category: '调查', difficulty: '常规', duration: 90 } } },
          { id: 'end', kind: 'end', x: 756, y: 160, title: '收束', data: { kind: 'end' } },
        ],
        edges: [
          { id: 'e1', from: 'start', fromPort: 'out', to: 'scene-1' },
          { id: 'e2', from: 'scene-1', fromPort: 'out', to: 'beat-1' },
          { id: 'e3', from: 'beat-1', fromPort: 'success', to: 'end' },
          { id: 'e4', from: 'beat-1', fromPort: 'failure', to: 'end' },
        ],
      },
    };
    before.storylines = []; before.events = []; before.incidents = [];
    before.missions = before.missions.filter(m => !m.storylineId);
    await page.evaluate(() => {
      const presets = JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]');
      for (const preset of presets) if (preset.api) preset.api.apiKey = '';
      localStorage.setItem('night-sugar:presets', JSON.stringify(presets));
      localStorage.setItem('night-sugar:preset-binding', JSON.stringify({ chat: 'builtin-balanced', daily: 'builtin-strict', profile: 'builtin-strict', storyline: 'builtin-balanced', event: 'builtin-balanced', arc: 'builtin-balanced', incident: 'builtin-balanced', outfit: 'builtin-strict' }));
      localStorage.removeItem('night-sugar:llm-config');
    });
    await page.evaluate(next => localStorage.setItem('night-sugar-office:v1', JSON.stringify(next)), before);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-story-start').click();
    await expect(page.locator('.story-mission')).toBeVisible();
    await expect(page.locator('.story-mission')).toContainText('夜巡河岸');
    await page.locator('.story-mission').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/story-panel.png', fullPage: false, animations: 'disabled' });
    const started = await stored();
    const story = started.storylines.find(item => item.girlId === 'yue');
    const mission = started.missions.find(item => item.storylineId === story.id);
    expect(mission.storyBeatId).toBe('beat-1');
    expect(mission.window).toBe('long');
    expect(mission.storyGoal.length).toBeGreaterThan(4);
    await page.locator('#dossier-story-mission').click();
    await expect(page.locator('.mission-story')).toContainText('这一幕的明确目标');
    await page.screenshot({ path: 'artifacts/story-mission.png', fullPage: false, animations: 'disabled' });
    await page.locator('#modal-close').click();
    await page.keyboard.press('Escape');
    // 打烊后故事委托仍在（不随普通委托清理）
    await page.locator('#end-night').click();
    await page.locator('#end-night-confirm').click();
    await page.waitForTimeout(300);
    const next = await stored();
    expect(next.missions.some(item => item.storylineId === story.id)).toBe(true);
    expect(next.storylines[0].status).toBe('active');
    await settleIncidents();
  });

  await check('分幕剧情：无 Key 也有四段模板剧情，选择到底后收束', async () => {
    const base = await stored();
    base.storylines = []; base.incidents = []; base.missions = [];
    base.events = [{ id: 'ev-arc-test', girlId: 'yue', title: '临时的一晚', hook: '她把伞收起来，水滴了一路。', scenes: [], stage: 0, status: 'active', day: base.day, source: 'template', badge: true, mode: 'story', passages: [], passageIndex: 0, pending: true }];
    const yue = base.girls.find(g => g.id === 'yue');
    yue.eventBadge = '新'; yue.status = 'idle'; yue.remaining = 0;
    await page.evaluate(next => localStorage.setItem('night-sugar-office:v1', JSON.stringify(next)), base);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-event-enter').scrollIntoViewIfNeeded();
    await page.locator('#dossier-event-enter').dispatchEvent('click');
    await expect(page.locator('.story-player')).toBeVisible();
    await page.locator('#story-choice-p1-a, #story-choice-p1-b').first().waitFor({ timeout: 8000 });
    await page.screenshot({ path: 'artifacts/story-player.png', fullPage: false, animations: 'disabled' });
    for (let index = 0; index < 4; index += 1) {
      const choice = page.locator('.story-choices .story-choice').first();
      await choice.waitFor();
      await choice.click();
      await page.waitForTimeout(120);
    }
    await expect(page.locator('#story-close')).toBeVisible();
    await page.screenshot({ path: 'artifacts/story-player-end.png', fullPage: false, animations: 'disabled' });
    await page.locator('#story-close').click();
    const done = await stored();
    const event = done.events.find(item => item.id === 'ev-arc-test');
    expect(event.status).toBe('done');
    expect(event.passages.length).toBe(4);
    const yueAfter = done.girls.find(g => g.id === 'yue');
    expect(yueAfter.bond).toBeGreaterThan(60);
  });

  await check('故事蓝图：可加节点、校验并保存进卡片', async () => {
    await page.evaluate(() => { localStorage.setItem('night-sugar-office:started', '1'); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const key = 'night-sugar-office:v1';
      const s = JSON.parse(localStorage.getItem(key));
      s.storylines = []; s.events = []; s.incidents = [];
      const yue = s.girls.find(g => g.id === 'yue');
      yue.bond = 60; yue.storyPlan = undefined;
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-story-graph').click();
    await expect(page.locator('.story-graph-modal')).toBeVisible();
    const before = await page.locator('.graph-node').count();
    await page.locator('#story-graph-add-choice').click();
    await expect.poll(async () => page.locator('.graph-node').count()).toBe(before + 1);

    // 默认图只保留第一幕到「继续」，不发散成四幕
    expect(before).toBeGreaterThanOrEqual(5);
    expect(before).toBeLessThanOrEqual(8);
    // 新节点落在当前视口中央，而不是最左端
    const addedBox = await page.locator('.graph-node.choice').last().boundingBox();
    const viewBox = await page.locator('.story-graph-canvas').boundingBox();
    expect(addedBox.x).toBeGreaterThan(viewBox.x + 40);
    expect(addedBox.x + addedBox.width).toBeLessThan(viewBox.x + viewBox.width - 40);

    // 复制 / 粘贴
    await page.locator('#story-graph-copy').click();
    await page.locator('#story-graph-paste').click();
    await expect.poll(async () => page.locator('.graph-node').count()).toBe(before + 2);

    // 键盘复制粘贴
    await page.locator('.graph-node').last().click();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect.poll(async () => page.locator('.graph-node').count()).toBe(before + 3);

    // 拖端口连线（先缩放到全图，保证出口与目标都在视口内）
    await page.locator('#story-graph-fit').click();
    const choiceNode = page.locator('.graph-node.choice').last();
    const choiceId = await choiceNode.getAttribute('data-node-id');
    const targetNode = page.locator('.graph-node.end').first();
    const targetId = await targetNode.getAttribute('data-node-id');
    const beforeEdges = await page.locator('.story-graph-edges path.graph-edge:not(.linking)').count();
    const port = choiceNode.locator('.graph-port:not(.in)').first();
    await targetNode.scrollIntoViewIfNeeded();
    await port.scrollIntoViewIfNeeded();
    const portBox = await port.boundingBox();
    const targetBox = await targetNode.boundingBox();
    await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => page.locator('.story-graph-edges path.graph-edge:not(.linking)').count()).toBeGreaterThan(beforeEdges);

    // 换一个目标重连：同一条出口直接覆盖旧线，不新增边
    const replacement = page.locator('.graph-node.reward').first();
    const replacementId = await replacement.getAttribute('data-node-id');
    const edgesBeforeReplace = await page.locator('.story-graph-edges path.graph-edge:not(.linking)').count();
    await replacement.scrollIntoViewIfNeeded();
    await port.scrollIntoViewIfNeeded();
    // 点出口再点目标：直接覆盖同一条出口的旧连线
    await port.click();
    await replacement.click();
    await expect.poll(async () => page.locator('.story-graph-edges path.graph-edge:not(.linking)').count()).toBe(edgesBeforeReplace);

    // 阶段委托：套用现有模板，并带成功 / 失败两个出口
    await page.locator('#story-graph-add-mission').click();
    const missionNode = page.locator('.graph-node.mission').last();
    await missionNode.click();
    await expect(missionNode.locator('.graph-port:not(.in)')).toHaveCount(2);
    await expect(missionNode.locator('.graph-port-tag')).toHaveText(['成功', '失败']);
    const templateValue = await page.locator('#story-graph-mission-template option').nth(1).getAttribute('value');
    await page.locator('#story-graph-mission-template').selectOption(templateValue);
    await expect(page.locator('#story-graph-mission-title')).not.toHaveValue('');

    // 奖励节点：星砂 / 技能 / 数值成长 / 临时增益
    await page.locator('#story-graph-add-reward').click();
    const rewardNode = page.locator('.graph-node.reward').last();
    const rewardId = await rewardNode.getAttribute('data-node-id');
    await rewardNode.click();
    await page.locator('#story-graph-reward-gold').fill('777');
    await page.locator('#story-graph-reward-skill').selectOption({ index: 1 });
    await page.locator('#story-graph-reward-growth-magic').fill('3');
    await page.locator('#story-graph-reward-buff').fill('夜色回响');

    // 复制 / 粘贴
    const afterAdds = await page.locator('.graph-node').count();
    await page.locator('#story-graph-copy').click();
    await page.locator('#story-graph-paste').click();
    await expect.poll(async () => page.locator('.graph-node').count()).toBe(afterAdds + 1);

    // 键盘复制粘贴
    await page.locator('.graph-node').last().click();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    await expect.poll(async () => page.locator('.graph-node').count()).toBe(afterAdds + 2);

    await page.locator('#story-graph-zoom-reset').click();
    await page.locator('#story-graph-zoom-in').click();
    await page.locator('#story-graph-zoom-in').click();
    await expect(page.locator('#story-graph-zoom-reset')).toContainText('120%');
    await page.locator('#story-graph-zoom-reset').click();

    await page.locator('#story-graph-auto-layout').click();
    await page.locator('#story-graph-fit').click();

    // 滚轮直接缩放
    const zoomBox = await page.locator('.story-graph-canvas').boundingBox();
    await page.mouse.move(zoomBox.x + zoomBox.width / 2, zoomBox.y + zoomBox.height / 2);
    await page.mouse.wheel(0, -160);
    await expect.poll(async () => page.locator('#story-graph-zoom-reset').innerText()).not.toBe('100%');
    await page.locator('#story-graph-zoom-reset').click();
    for (let i = 0; i < 6; i += 1) await page.locator('#story-graph-zoom-in').click();

    // 右键拖动平移
    await page.evaluate(() => {
      const host = document.querySelector('.story-graph-canvas');
      if (host) { host.scrollLeft = 300; host.scrollTop = 120; }
    });
    const panBox = await page.locator('.story-graph-canvas').boundingBox();
    await page.mouse.move(panBox.x + panBox.width / 2, panBox.y + panBox.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(panBox.x + panBox.width / 2 + 150, panBox.y + panBox.height / 2 + 60, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await expect.poll(async () => page.evaluate(() => document.querySelector('.story-graph-canvas')?.scrollLeft ?? -1)).toBeLessThan(300);
    await page.locator('#story-graph-zoom-reset').click();

    // 空白处框选两个以上节点
    await page.evaluate(() => { const host = document.querySelector('.story-graph-canvas'); if (host) { host.scrollLeft = 0; host.scrollTop = 0; } });
    const canvasBox = await page.locator('.story-graph-canvas').boundingBox();
    await page.mouse.move(canvasBox.x + 12, canvasBox.y + 56);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 720, canvasBox.y + 420, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => page.locator('.graph-node.on').count()).toBeGreaterThan(1);

    await page.locator('#story-graph-dryrun').click();
    await expect(page.locator('.graph-dry')).toBeVisible();
    await expect.poll(async () => page.locator('.graph-dry-step').count()).toBeGreaterThan(4);
    await page.locator('#story-graph-dry-close').click();

    await page.locator('#story-graph-beats').click();
    await expect(page.locator('.graph-beats')).toBeVisible();
    await expect.poll(async () => page.locator('.graph-beats li').count()).toBeGreaterThan(0);
    await page.locator('#story-graph-beats-close').click();

    await page.locator('#story-graph-validate').click();
    await expect(page.locator('.story-graph-issues')).toBeVisible();
    await page.screenshot({ path: 'artifacts/story-graph-flow.png', fullPage: true, animations: 'disabled' });
    await page.locator('#story-graph-save').click();
    const saved = await stored();
    const graph = saved.girls.find(g => g.id === 'yue')?.storyPlan?.graph;
    expect(graph?.nodes?.length).toBeGreaterThan(before);
    expect(graph?.edges?.some(edge => edge.from === choiceId && edge.to === replacementId)).toBe(true);
    expect(graph?.edges?.some(edge => edge.from === choiceId && edge.to === targetId)).toBe(false);
    const savedReward = graph?.nodes?.find(node => node.id === rewardId);
    expect(savedReward?.data.kind).toBe('reward');
    if (savedReward?.data.kind === 'reward') {
      expect(savedReward.data.effect.gold).toBe(777);
      expect(savedReward.data.effect.skill?.id).toBeTruthy();
      expect(savedReward.data.effect.growth?.magic).toBe(3);
      expect(savedReward.data.effect.buff?.name).toBe('夜色回响');
    }
  });

  await check('故事蓝图：事件节点可从内容工坊弹窗卡导入', async () => {
    const incidentId = await page.evaluate(() => {
      const library = JSON.parse(localStorage.getItem('night-sugar:content:v1') ?? '{}');
      return library.incidents?.[0]?.id ?? '';
    });
    expect(incidentId).toBeTruthy();
    await page.evaluate(() => {
      const raw = localStorage.getItem('night-sugar-office:v1');
      if (!raw) return;
      const state = JSON.parse(raw);
      state.storylines = []; state.events = []; state.incidents = [];
      const girl = state.girls.find(entry => entry.id === 'yue') ?? state.girls[0];
      girl.bond = 60; girl.storyPlan = undefined;
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-story-graph').click();
    await expect(page.locator('.story-graph-modal')).toBeVisible();
    await page.locator('#story-graph-add-incident').click();
    const incidentNode = page.locator('.graph-node.incident').last();
    await incidentNode.click();
    await page.locator('#story-graph-incident-card').selectOption(incidentId);
    await expect(page.locator('label:has-text("事件标题") input')).toHaveValue('测试·夜巡弹窗');
    await expect(page.locator('label:has-text("正文") textarea')).toHaveValue(/雨停之后/);
    await page.locator('#story-graph-save').click();
    const saved = await stored();
    const nodes = saved.girls.find(entry => entry.id === 'yue')?.storyPlan?.graph?.nodes ?? [];
    const imported = nodes.find(node => node.data.kind === 'incident' && node.data.spec.cardId === incidentId);
    expect(imported).toBeTruthy();
  });

  await check('故事蓝图：没有 Key 时用四幕模板生成，编辑资料后按蓝图开场', async () => {
    await page.evaluate(() => {
      const raw = localStorage.getItem('night-sugar-office:v1');
      if (!raw) return;
      const s = JSON.parse(raw);
      s.storylines = []; s.events = []; s.incidents = [];
      const girl = s.girls.find(g => g.id === 'yue') ?? s.girls[0];
      girl.bond = 60; girl.storyPlan = undefined;
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(s));
      const presets = JSON.parse(localStorage.getItem('night-sugar:presets') ?? '[]');
      for (const preset of presets) if (preset.api) preset.api.apiKey = '';
      localStorage.setItem('night-sugar:presets', JSON.stringify(presets));
      localStorage.removeItem('night-sugar:llm-config');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-story-blueprint').click();
    await expect(page.locator('.story-graph-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.story-graph-notice')).toContainText('模板');
    await page.locator('#story-graph-meta').click();
    await page.locator('#story-graph-title').fill('未寄出的信');
    await page.locator('#story-graph-premise').fill('她有一封没寄出的信，地址写着已经拆掉的旧事务所。');
    await page.locator('#story-graph-tone').fill('克制');
    await page.screenshot({ path: 'artifacts/story-graph-generated.png', fullPage: false, animations: 'disabled' });
    await page.locator('#story-graph-save').click();
    await expect(page.locator('#dossier-story-plan')).toContainText('未寄出的信');
    await expect(page.locator('#dossier-story-start')).toContainText('按蓝图开场');
    const savedPlan = (await stored()).girls.find(g => g.id === 'yue')?.storyPlan;
    expect(savedPlan?.graph?.nodes.length).toBeGreaterThanOrEqual(8);
    expect(savedPlan?.graph?.nodes.some(node => node.kind === 'end')).toBe(true);
    await page.locator('#dossier-story-plan').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/story-plan-dossier.png', animations: 'disabled' });
    await page.locator('#dossier-story-start').click();
    await expect(page.locator('.story-beat')).toBeVisible();
    const saved = await stored();
    expect(saved.girls.find(g => g.id === 'yue')?.storyPlan?.title).toBe('未寄出的信');
    const story = saved.storylines.find(item => item.status === 'active');
    expect(story?.source).toBe('manual');
    expect(story?.graph?.nodes.length).toBeGreaterThanOrEqual(8);
    expect(story?.beats.length).toBeGreaterThan(0);
    await close();
  });
await check('诊所治疗：按缺失血量收费、治疗中不能出勤、按时回血', async () => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.setItem('night-sugar-office:started', '1');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('night-sugar-office:v1'));
      raw.girls.forEach(g => { g.status = 'idle'; g.remaining = 0; g.retired = false; });
      const yue = raw.girls.find(g => g.id === 'yue');
      yue.hp = 40;
      raw.gold = 4000; raw.treatments = [];
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await settleIncidents();
    await page.locator('#nav-dispatch').click();
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-growth').click();
    const missing = 80;
    const cost = 120 + missing * 9;
    await expect(page.locator('#clinic-row-yue')).toContainText(`缺 ${missing} 点生命`);
    await expect(page.locator('#clinic-treat-yue')).toContainText(String(cost));
    await expect(page.locator('#clinic-kink-yue')).toContainText('320');
    await expect(page.locator('#clinic-kink-yue')).toContainText('2 小时');
    await page.locator('.growth-clinic').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/clinic.png', fullPage: true, animations: 'disabled' });
    await page.locator('#clinic-treat-yue').click();
    await expect.poll(async () => (await stored()).treatments.length).toBe(1);
    const started = await stored();
    expect(started.girls.find(g => g.id === 'yue').status).toBe('healing');
    expect(started.gold).toBe(4000 - 840);
    await close();
    await page.locator('#advance-time-30').click();
    await page.locator('#advance-time-30').click();
    const mid = (await stored()).girls.find(g => g.id === 'yue');
    expect(mid.hp).toBeGreaterThan(40);
    expect(mid.hp).toBeLessThan(mid.maxHp);
    await page.locator('#open-command').click();
    await page.locator('#cmd-input').fill('advance 180'); await page.locator('#cmd-run').click();
    await page.waitForTimeout(600);
    await page.locator('#cmd-input').fill('advance 180'); await page.locator('#cmd-run').click();
    await page.waitForTimeout(900);
    await page.locator('#cmd-close').click();
    await expect.poll(async () => (await stored()).treatments.length).toBe(0);
    const healed = (await stored()).girls.find(g => g.id === 'yue');
    expect(healed.status).toBe('idle');
    expect(healed.hp).toBe(healed.maxHp);
    await page.locator('#open-command').click();
    await page.locator('#cmd-input').fill('end'); await page.locator('#cmd-run').click();
    await page.locator('#end-night-confirm').click();
    await expect.poll(async () => (await stored()).minutes).toBe(20 * 60);
    await settleIncidents();
  });
  await check('叙事引擎快照能按 prompt_order 显示预设槽位', async () => {
    await page.evaluate(() => {
      const entry = {
        id: 'slot-test-1', at: new Date().toISOString(), kind: '角色剧情', ok: true, model: 'mock-story',
        endpoint: 'https://mock.local/v1', status: 200, durationMs: 1200, message: '测试槽位顺序',
        request: { sections: [{ label: '世界观 + 预设 + 剧情规则', text: '系统提示' }], params: { temperature: 1.08, max_tokens: 32768 }, messageCount: 1, slots: [
          { index: 1, name: 'main', role: 'system', tokens: 320, enabled: true, marker: false },
          { index: 2, name: 'jailbreak', role: 'system', tokens: 96, enabled: false, marker: false },
          { index: 3, name: 'dialogueExamples', role: 'system', tokens: 0, enabled: true, marker: true },
        ] },
      };
      localStorage.setItem('night-sugar:llm-log', JSON.stringify([entry]));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#llm-console-toggle').click();
    await page.locator('.llm-entry').first().click();
    await expect(page.locator('#llm-slot-1')).toContainText('main');
    await expect(page.locator('#llm-slot-2')).toHaveClass(/off/);
    await expect(page.locator('#llm-slot-3')).toHaveClass(/marker/);
    await page.screenshot({ path: 'artifacts/llm-slots.png', animations: 'disabled' });
    await page.locator('#llm-console-toggle').click();
  });
  await check('魔女化：独立表情页、真实立绘切换与恢复普通服装', async () => {
    const witchArt = await page.evaluate(() => {
      const make = (fill) => {
        const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 500;
        const ctx = canvas.getContext('2d'); if (!ctx) return '';
        ctx.fillStyle = fill; ctx.fillRect(0, 0, 400, 500);
        ctx.fillStyle = '#f5d9e6'; ctx.beginPath(); ctx.arc(200, 210, 86, 0, Math.PI * 2); ctx.fill();
        return canvas.toDataURL('image/png');
      };
      return { base: make('#315f9a'), variant: make('#b23a5e') };
    });
    const beforeWitch = await stored();
    await page.evaluate(({ base, variant }) => {
      const raw = JSON.parse(localStorage.getItem('night-sugar-office:v1'));
      const yue = raw.girls.find(girl => girl.id === 'yue');
      yue.corruption = 60; yue.witch = false;
      yue.witchForm = { id: 'witchform', name: '魔女化 · 夜之形', description: '另一种轮廓。', palette: ['#2a1524', '#c478b8', '#f3aec9'], layerKey: 'formal', form: 'witch', portrait: base };
      yue.importedVariants = { ...(yue.importedVariants ?? {}), 'witchform:calm': variant };
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(raw));
    }, witchArt);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-dispatch').click();
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-witch-slot').click();
    await expect.poll(async () => (await stored()).girls.find(girl => girl.id === 'yue').witch).toBe(true);
    await expect(page.locator('.dossier-art .girl-portrait img')).toHaveAttribute('src', witchArt.variant);
    await page.locator('#dossier-expression-manage').click();
    await expect(page.locator('#expression-variant-outfit-witchform')).toBeVisible();
    await expect(page.locator('#expression-variant-outfit-witchform')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#expression-variant-card-calm .expression-variant-state')).toHaveText('已导入');
    await page.screenshot({ path: 'artifacts/expression-variants-witch.png', animations: 'disabled' });
    await page.locator('#expression-variant-close').click();
    await close();
    await page.evaluate(snapshot => localStorage.setItem('night-sugar-office:v1', JSON.stringify(snapshot)), beforeWitch);
    await page.reload({ waitUntil: 'networkidle' });
  });
  await check('魔女化：预留导入、服装锁定与档案性格编辑', async () => {
    const beforeWitch = await stored();
    const normalPersonality = beforeWitch.girls.find(girl => girl.id === 'yue').personality;
    const art = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 500;
      const ctx = canvas.getContext('2d'); if (!ctx) return '';
      ctx.fillStyle = '#3b2254'; ctx.fillRect(0, 0, 400, 500);
      ctx.fillStyle = '#e8b3d3'; ctx.beginPath(); ctx.arc(200, 210, 86, 0, Math.PI * 2); ctx.fill();
      return canvas.toDataURL('image/png');
    });
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('night-sugar-office:v1'));
      const yue = raw.girls.find(girl => girl.id === 'yue');
      yue.corruption = 20; yue.witch = false;
      delete yue.witchForm; delete yue.witchPersonality;
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-dispatch').click();
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-witch-import').click();
    await page.locator('#witch-form-file').setInputFiles({ name: 'yue-witch.png', mimeType: 'image/png', buffer: Buffer.from(art.split(',')[1], 'base64') });
    await page.locator('#witch-form-name').fill('魔女化 · 夜之形');
    await page.locator('#witch-form-description').fill('影子比本人先一步抵达。');
    await page.screenshot({ path: 'artifacts/witch-form-dialog.png', animations: 'disabled' });
    await page.locator('#witch-form-save').click();
    await expect.poll(async () => {
      const yue = (await stored()).girls.find(girl => girl.id === 'yue');
      return Boolean(yue.witchForm?.portrait?.startsWith('data:image/') && !yue.witch);
    }).toBe(true);
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-witch-slot').click();
    await expect.poll(async () => (await stored()).girls.find(girl => girl.id === 'yue').witch).toBe(false);

    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('night-sugar-office:v1'));
      raw.girls.find(girl => girl.id === 'yue').corruption = 60;
      localStorage.setItem('night-sugar-office:v1', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-dispatch').click();
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-witch-slot').click();
    await expect.poll(async () => (await stored()).girls.find(girl => girl.id === 'yue').witch).toBe(true);
    await page.screenshot({ path: 'artifacts/witch-lock.png', animations: 'disabled' });
    await page.locator('#dossier-outfit-casual').click({ force: true });
    await expect.poll(async () => (await stored()).girls.find(girl => girl.id === 'yue').witch).toBe(true);

    await page.locator('#dossier-tab-overview').click();
    await expect(page.locator('.personality-panel')).toContainText('偏执');
    await page.locator('#dossier-personality-edit').click();
    await page.locator('#dossier-personality-input').fill('只想把所长留在身边，其他声音都该消失。');
    await page.locator('#dossier-personality-save').click();
    await expect.poll(async () => (await stored()).girls.find(girl => girl.id === 'yue').witchPersonality).toBe('只想把所长留在身边，其他声音都该消失。');
    const edited = (await stored()).girls.find(girl => girl.id === 'yue');
    expect(edited.personality).toBe(normalPersonality);
    await page.screenshot({ path: 'artifacts/witch-personality.png', animations: 'disabled' });

    await page.locator('#dossier-tab-appearance').click();
    await page.locator('#dossier-witch-slot').click();
    const restored = (await stored()).girls.find(girl => girl.id === 'yue');
    expect(restored.witch).toBe(false);
    expect(restored.witchForm?.portrait?.startsWith('data:image/')).toBe(true);
    await close();
    await page.evaluate(snapshot => localStorage.setItem('night-sugar-office:v1', JSON.stringify(snapshot)), beforeWitch);
    await page.reload({ waitUntil: 'networkidle' });
  });
  await check('自定义登记：衣柜包带入多套服装、表情差分与魔女化立绘', async () => {
    const swatches = await page.evaluate(() => {
      const make = (fill) => {
        const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 500;
        const ctx = canvas.getContext('2d'); if (!ctx) return '';
        ctx.fillStyle = fill; ctx.fillRect(0, 0, 400, 500);
        ctx.fillStyle = '#f5d9e6'; ctx.beginPath(); ctx.arc(200, 210, 86, 0, Math.PI * 2); ctx.fill();
        return canvas.toDataURL('image/png');
      };
      return { uniform: make('#8fb8c9'), casual: make('#d8a5e6'), witch: make('#e58c8c') };
    });
    const pack = {
      wardrobe: [
        { id: 'uniform', name: '值夜制服', description: '带星形扣子的制服。', palette: ['#d98aa8'], layerKey: 'uniform', portrait: swatches.uniform },
        { id: 'casual', name: '休闲装', description: '下班后穿的便服。', palette: ['#8fb8c9'], layerKey: 'casual', portrait: swatches.casual },
      ],
      outfitId: 'casual',
      importedVariants: { 'uniform:calm': swatches.uniform, 'casual:smile': swatches.casual, 'witchform:angry': swatches.witch },
      witchForm: { id: 'witchform', name: '魔女化 · 夜之形', description: '另一种轮廓。', palette: ['#2a1524', '#c478b8'], layerKey: 'formal', form: 'witch', portrait: swatches.witch },
    };
    fs.writeFileSync('artifacts/fixture-wardrobe.json', JSON.stringify(pack));
    await page.locator('#nav-market').click();
    await page.locator('#av-market-custom').click();
    await page.locator('#custom-entry-blank').click();
    await page.locator('#custom-name').fill('衣柜登记');
    await page.locator('#custom-next').click();
    await page.locator('#custom-next').click();
    for (let i = 0; i < 3; i++) await page.locator('.custom-pick').nth(i).click();
    await page.locator('#custom-next').click();
    for (let i = 0; i < 3; i++) await page.locator('.custom-pick').nth(i).click();
    await page.locator('#custom-next').click();
    await page.setInputFiles('#custom-wardrobe-file', 'artifacts/fixture-wardrobe.json');
    await expect(page.locator('.custom-wardrobe-summary')).toContainText('2 套服装');
    await expect(page.locator('.custom-wardrobe-summary')).toContainText('3 张表情差分');
    await page.screenshot({ path: 'artifacts/custom-wardrobe-import.png', animations: 'disabled' });
    await page.locator('#custom-create').click();
    await expect.poll(async () => (await stored()).candidates.some(girl => girl.name === '衣柜登记')).toBe(true);
    const created = (await stored()).candidates.find(girl => girl.name === '衣柜登记');
    expect(created.wardrobe.length).toBe(2);
    expect(created.outfitId).toBe('casual');
    expect(created.importedVariants['uniform:calm']).toBeTruthy();
    expect(created.importedVariants['witchform:angry']).toBeTruthy();
    expect(created.witchForm.id).toBe('witchform');
    await close();
  });
  await check('地图污染层：九区读数、五级图例与辖区污染面板', async () => {
    await page.locator('#nav-dispatch').click();
    await expect(page.locator('.district-pollution-label')).toHaveCount(9);
    const legend = page.locator('#map-pollution-legend');
    await expect(legend).toContainText('城市平均');
    for (const label of ['清洁', '微浊', '浑浊', '深染', '灾厄']) await expect(legend).toContainText(label);
    const pollution = (await stored()).pollution;
    expect(Object.values(pollution).filter(level => level > 0).length).toBe(9);
    await page.evaluate(() => document.querySelector('.district-fill')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const panel = page.locator('[id^="district-pollution-"]');
    await expect(panel).toHaveCount(1);
    await expect(panel).toContainText('每日 +');
    await expect(panel).toContainText('完成委托约 −');
    await expect(panel).toContainText('当主');
    const focusedId = ((await panel.getAttribute('id')) ?? '').replace('district-pollution-', '');
    await expect(panel).toContainText(`污染 ${pollution[focusedId]}`);
    await page.screenshot({ path: 'artifacts/pollution-panel.png', animations: 'disabled' });
    await page.locator('#map-reset-view').click();
    await expect(page.locator('[id^="district-pollution-"]')).toHaveCount(0);
  });

  await check('势力档案：会长立绘、五个页签与所属少女', async () => {
    await page.locator('#dispatch-faction-association').click();
    await expect(page.locator('#faction-dialog')).toBeVisible();
    await expect(page.locator('#faction-leader-name')).toHaveText('白鹭千秋');
    await expect(page.locator('#faction-leader-portrait svg')).toBeVisible();
    await expect(page.locator('#faction-leader')).toContainText('名录之外，没有灯。');
    for (const tab of ['origin', 'members', 'city', 'witch', 'relations']) await expect(page.locator(`#faction-tab-${tab}`)).toBeVisible();
    await expect(page.locator('.faction-rows')).toContainText('量产与抑制剂');
    await page.locator('#faction-tab-members').click();
    await expect(page.locator('.faction-girl-list .faction-girl')).toHaveCount(3);
    await page.locator('#faction-girl-fg-association-tou').click();
    await expect(page.locator('.faction-girl-detail')).toContainText('只会在辖区戒备时出面拦截');
    await page.locator('#faction-tab-city').click();
    await expect(page.locator('.faction-city-facts')).toContainText('完成委托额外净化');
    await layout('faction dialog');
    await page.screenshot({ path: 'artifacts/faction-dialog.png', animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 900 });
    await layout('faction dialog 390');
    await page.screenshot({ path: 'artifacts/faction-dialog-390.png', animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.locator('#faction-close').click();
    await expect(page.locator('#faction-dialog')).toHaveCount(0);
  });

  await check('势力档案：月蚀庭政变线，档案可直接前往会客厅', async () => {
    await page.locator('#dispatch-faction-witch').click();
    await expect(page.locator('#faction-leader-name')).toHaveText('蚀医·夜鸮');
    await page.locator('#faction-tab-witch').click();
    await expect(page.locator('#faction-coup')).toBeVisible();
    await expect(page.locator('.faction-tab-body')).toContainText('魔女化');
    await page.locator('#faction-tab-relations').click();
    await expect(page.locator('.faction-representative')).toContainText('事务所对外代表');
    await expect(page.locator('.faction-rows')).toContainText('星灯协会');
    await page.locator('#faction-go-base').click();
    await expect(page.locator('#faction-dialog')).toHaveCount(0);
    await expect(page.locator('#open-office-profile')).toBeVisible();
  });

  await check('出身标签：名册与详情页把雇主和出身分开显示', async () => {
    await page.locator('#nav-dispatch').click();
    const active = (await stored()).girls.filter(g => !g.dead && !g.retired);
    await expect(page.locator('.roster-origin')).toHaveCount(active.length);
    await expect(page.locator('.roster-origin').first()).toContainText(/星灯协会|市役所|月蚀庭|无所属/);
    await page.locator('#roster-girl-yue').click();
    await expect(page.locator('#girl-origin-yue')).toContainText('出身');
    await expect(page.locator('.affiliation-employer')).toHaveText('夜糖事务所');
    await page.screenshot({ path: 'artifacts/origin-tags.png', animations: 'disabled' });
    await page.keyboard.press('Escape');
  });

  await check('市场候选卡显示出身，自定义登记可选任意出身', async () => {
    await page.locator('#nav-market').click();
    await expect(page.locator('[id^="av-candidate-origin-"]').first()).toContainText('出身');
    await page.locator('#av-market-custom').click();
    await page.locator('#custom-entry-blank').click();
    await page.locator('#custom-name').fill('出身校验');
    await expect(page.locator('#custom-origin-witch')).toBeVisible();
    await expect(page.locator('#custom-origin-auto')).toBeDisabled();
    await page.locator('#custom-origin-witch').click();
    await expect(page.locator('#custom-origin-witch')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#custom-origin-auto')).toBeEnabled();
    await expect(page.locator('#custom-origin-auto')).toContainText('按名字推导');
    await page.locator('#custom-origin-auto').click();
    await expect(page.locator('#custom-origin-witch')).toHaveAttribute('aria-checked', 'false');
    await page.locator('#custom-origin-none').click();
    await expect(page.locator('#custom-origin-none')).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: 'artifacts/custom-origin.png', animations: 'disabled' });
    await page.locator('#modal-close').click();
  });

  await check('事务所档案：编辑背景与目标、任命代表并同步世界书', async () => {
    const before = await stored();
    const yue = before.girls.find(g => g.id === 'yue');
    yue.bond = 60;
    yue.status = 'idle';
    await page.evaluate(next => localStorage.setItem('night-sugar-office:v1', JSON.stringify(next)), before);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#nav-base').click();
    await page.locator('#open-office-profile').click();
    await expect(page.locator('#office-dialog')).toBeVisible();
    await expect(page.locator('#office-dialog')).toContainText('不属于任何一方');
    await page.locator('#office-assistant-yue').click();
    await expect(page.locator('#office-representative')).toContainText('月见桃');
    await page.locator('#office-background').fill('旧糖果店的二楼，关门前是城里的失物招领处。');
    await page.locator('#office-goal').fill('让每个出身的少女都有地方挂外套。');
    await layout('office dialog');
    await page.screenshot({ path: 'artifacts/office-dialog.png', animations: 'disabled' });
    await page.locator('#office-save').click();
    await expect(page.locator('#office-dialog')).toHaveCount(0);
    const after = await stored();
    expect(after.office.background).toBe('旧糖果店的二楼，关门前是城里的失物招领处。');
    expect(after.office.goal).toBe('让每个出身的少女都有地方挂外套。');
    expect(after.assistantId).toBe('yue');
    await expect.poll(async () => page.evaluate(() => {
      const book = JSON.parse(localStorage.getItem('night-sugar:worldbook') ?? '[]');
      return book.find(item => item.id === 'office-profile')?.content ?? '';
    })).toContain('失物招领处');
    const content = await page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar:worldbook') ?? '[]').find(item => item.id === 'office-profile').content);
    expect(content).toContain('让每个出身的少女都有地方挂外套。');
    expect(content).toContain('月见桃');
  });

  await check('世界书：事务所条目只读，并能跳回档案', async () => {
    await page.locator('#open-worldbook').click();
    await page.locator('#worldbook-tab-entries').click();
    await page.locator('#worldbook-entry-office-profile').click();
    await expect(page.locator('.wb-generated')).toContainText('由事务所档案自动生成');
    await expect(page.locator('#worldbook-content')).toHaveJSProperty('readOnly', true);
    await expect(page.locator('#worldbook-content')).toHaveValue(/失物招领处/);
    await page.screenshot({ path: 'artifacts/worldbook-office.png', animations: 'disabled' });
    await page.locator('#worldbook-open-office').click();
    await expect(page.locator('#office-dialog')).toBeVisible();
    await expect(page.locator('#office-background')).toHaveValue(/失物招领处/);
    await page.locator('#office-cancel').click();
    await expect(page.locator('#office-dialog')).toHaveCount(0);
    await expect(page.locator('#worldbook-content')).toHaveValue(/失物招领处/);
  });

  await check('委托详情显示辖区污染、风险项与净化预估', async () => {
    await page.locator('#nav-dispatch').click();
    const open = (await stored()).missions.find(m => m.status === 'open' && m.district);
    expect(Boolean(open)).toBe(true);
    await openMission(open.id);
    const block = page.locator(`#mission-pollution-${open.id}`);
    await expect(block).toBeVisible();
    await expect(block).toContainText('污染');
    await expect(block).toContainText('完成委托预计净化 −');
    await expect(page.locator('[id^="mission-interception-"]')).toHaveCount(0);
    await page.screenshot({ path: 'artifacts/mission-pollution.png', animations: 'disabled' });
    await page.locator('#modal-close').click();
  });

  await check('戒备辖区：委托预警，派遣后拦截战覆盖原委托', async () => {
    const before = await stored();
    const target = before.missions.find(m => m.status === 'open' && m.work === 'combat' && m.district && !m.boss && !m.storylineId && m.duration <= 60 && !m.envoyFaction);
    expect(Boolean(target)).toBe(true);
    before.factions.witch.standing = 20;
    before.territories[target.district] = 'witch';
    before.battles = [];
    for (const girl of before.girls) if (girl.status === 'mission') girl.status = 'idle';
    await page.evaluate(next => localStorage.setItem('night-sugar-office:v1', JSON.stringify(next)), before);
    await page.reload({ waitUntil: 'networkidle' });
    await openMission(target.id);
    await expect(page.locator(`#mission-interception-${target.id}`)).toContainText('月蚀在此戒备');
    await expect(page.locator(`#mission-interception-${target.id}`)).toContainText('拦截');
    await page.screenshot({ path: 'artifacts/interception-warning.png', animations: 'disabled' });
    for (const id of ['yue', 'tang', 'ling']) if (await page.locator(`#assign-${id}`).count()) await page.locator(`#assign-${id}`).click();
    await page.locator('#dispatch-confirm').click();
    await page.locator('#advance-time-30').click();
    await page.locator('#advance-time-30').click();
    await expect(page.locator('#battle-tab-replay')).toBeVisible({ timeout: 15000 });
    await page.locator('#battle-skip').click();
    await expect(page.locator('#battle-report-table')).toBeVisible();
    await page.screenshot({ path: 'artifacts/interception-battle.png', animations: 'disabled' });
    await page.locator('#battle-close').click();
    const after = await stored();
    const covered = after.missions.find(m => m.id === target.id);
    expect(covered.status).toBe('expired');
    expect(covered.interception.faction).toBe('witch');
    expect(covered.squad).toEqual([]);
    expect(after.factions.witch.standing).toBeLessThan(20);
    expect(['win', 'loss']).toContain(covered.interception.outcome);
    expect(covered.interception.girlIds.length).toBeGreaterThan(0);
    expect(after.logs.some(log => log.text.includes('拦截战'))).toBe(true);
  });

  await check('无浏览器错误或失败资源请求', async () => { if (failures.length) console.log('FAILED_REQUESTS', failures); expect(errors).toEqual([]); expect(failures).toEqual([]); });
} finally {
  fs.writeFileSync('artifacts/browser-results.json', JSON.stringify({ baseURL, results, errors, failures }, null, 2)); await browser.close();
}
