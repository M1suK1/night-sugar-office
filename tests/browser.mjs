import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';

const baseURL = process.env.PROTOTYPE_URL ?? 'http://127.0.0.1:5173';
fs.mkdirSync('artifacts', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
const errors = [], failures = [], results = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('requestfailed', r => failures.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('night-sugar-office:v1')));
const stored = async () => { await page.waitForTimeout(120); return state(); };
const close = async () => { if (await page.locator('dialog[open]').count()) await page.locator('#modal-close').click(); };
async function check(name, fn) { try { await fn(); results.push({ name, pass: true }); console.log(`PASS ${name}`); } catch (e) { results.push({ name, pass: false, error: e.message }); console.error(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: 'artifacts/failure.png', fullPage: true, animations: 'disabled' }); throw e; } }
async function layout(label) {
  const issues = await page.evaluate(() => { const seen = new Set(), duplicates = []; for (const e of document.querySelectorAll('[id]')) { if (seen.has(e.id)) duplicates.push(e.id); seen.add(e.id); } const missing = [...document.querySelectorAll('button,input,textarea,select,a')].filter(e => !e.id).map(e => `${e.tagName}:${e.textContent?.slice(0, 24)}`); return { width: innerWidth, scroll: document.documentElement.scrollWidth, duplicates, missing }; });
  expect(issues.duplicates, `${label} duplicate IDs`).toEqual([]); expect(issues.missing, `${label} interactive IDs`).toEqual([]); expect(issues.scroll, `${label} horizontal overflow`).toBeLessThanOrEqual(issues.width + 1);
}
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready);
  await check('首页地图、七项委托与分类筛选', async () => {
    await expect(page.locator('.mission-pin')).toHaveCount(7);
    await expect(page.locator('.girl-roster-card')).toHaveCount(4);
    await page.locator('#map-filter-combat').click();
    await expect(page.locator('.mission-pin:not(.filtered)')).toHaveCount(4);
    await page.locator('#map-filter-investigation').click();
    await expect(page.locator('.mission-pin:not(.filtered)')).toHaveCount(3);
    await page.locator('#map-filter-all').click();
    const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
    expect(broken).toEqual([]); await layout('desktop');
    await page.screenshot({ path: 'artifacts/dispatch-desktop.png', fullPage: true, animations: 'disabled' });
  });
  await check('人物档案：四页、技能池、疤痕槽与关系七阶键盘导航', async () => {
    await page.locator('#roster-girl-yue').hover(); await expect(page.locator('#tooltip-yue')).toBeVisible();
    await page.locator('#roster-girl-yue').click();
    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.locator('.scar-slot')).toHaveCount(5);
    await page.locator('#dossier-tab-overview').focus(); await page.keyboard.press('ArrowRight');
    await expect(page.locator('#dossier-tab-ability')).toBeFocused(); await expect(page.locator('#dossier-tab-ability')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.skill-card')).toHaveCount(3);
    await page.locator('#dossier-tab-relations').click();
    await expect(page.locator('.relation-legend span')).toHaveCount(7);
    await expect(page.locator('.peer-row')).toHaveCount(3);
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
    expect((await stored()).missions.find(m => m.id === 'candy').squad).toEqual(['yue', 'tang']);
    await page.locator('#advance-time-30').click(); await page.locator('#advance-time-30').click();
    await expect.poll(async () => (await stored()).missions.find(m => m.id === 'candy').status).toBe('done');
    expect((await stored()).gold).toBe(13520);
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
    await page.screenshot({ path: 'artifacts/battle-replay.png', fullPage: true, animations: 'disabled' });
    await page.locator('#battle-skip').click();
    await expect(page.locator('#battle-report-table')).toBeVisible();
    await expect(page.locator('.battle-outcome')).toContainText('击退');
    const saved = await stored();
    expect(saved.battles[0].outcome).toBe('repelled');
    expect(saved.missions.find(m => m.id === 'station').status).toBe('open');
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
    await page.locator('#av-market-search').fill('栀子');
    await expect(page.locator('.av-candidate')).toHaveCount(1);
    await page.locator('#av-market-preview-zhi').click(); await expect(page.locator('dialog')).toContainText('栀子');
    await close();
    const before = await stored();
    await page.locator('#av-market-hire-zhi').click(); await page.locator('#hire-confirm').click();
    const after = await stored();
    expect(after.girls).toHaveLength(5); expect(after.gold).toBe(before.gold - 2400);
  });
  await check('经营折线图、战斗档案与日志筛选', async () => {
    await page.locator('#nav-records').click(); await layout('records');
    await page.locator('#av-record-range').selectOption('14');
    await expect(page.locator('.av-chart-point')).toHaveCount(14);
    await expect(page.locator('.av-battle-row')).toHaveCount(1);
    await page.locator('#av-record-battle-title').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'artifacts/records-desktop.png', fullPage: true, animations: 'disabled' });
    const battleId = (await stored()).battles[0].id;
    await page.locator(`#av-record-battle-${battleId}`).click();
    await expect(page.locator('#battle-tab-replay')).toBeVisible();
    await page.locator('#battle-tab-report').click();
    await expect(page.locator('#battle-report-table')).toBeVisible(); await page.locator('#battle-close').click();
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
    expect((await stored()).gold).toBe(before.gold); expect((await stored()).girls).toHaveLength(5);
  });
  await check('自动推进开关与操作指南', async () => {
    await page.locator('#toggle-auto-time').click(); await expect(page.locator('#toggle-auto-time')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#toggle-auto-time').click();
    await page.locator('#open-help').click(); await expect(page.locator('.help-items>div')).toHaveCount(4);
    await page.keyboard.press('Escape'); await expect(page.locator('#open-help')).toBeFocused();
  });
  await check('响应式 1024、768、390、320 无横向溢出', async () => {
    for (const width of [1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const nav of ['dispatch', 'base', 'market', 'records']) { await page.locator(`#nav-${nav}`).click(); await layout(`${width}-${nav}`); if (width === 390) await page.screenshot({ path: `artifacts/${nav}-mobile.png`, fullPage: true, animations: 'disabled' }); }
      if (width === 390) { await page.locator('#nav-dispatch').click(); await page.locator('#roster-girl-tang').click(); await layout('mobile character'); await close(); }
    }
    await page.setViewportSize({ width: 1440, height: 1080 });
  });
  await check('重置后回到初始夜晚并清空战斗与纪念', async () => {
    await page.locator('#open-settings').click(); await page.locator('#settings-reset-save').click();
    await page.locator('#reset-confirm').click();
    const s = await stored();
    expect(s.gold).toBe(12840); expect(s.girls).toHaveLength(4); expect(s.battles).toEqual([]); expect(s.memorial).toEqual([]);
    await page.locator('#dismiss-toast').click();
  });
  await check('契约成长页：目标、经验、契约与诊所入口', async () => {
    await page.locator('#nav-dispatch').click();
    await page.locator('#roster-girl-yue').click();
    await page.locator('#dossier-tab-growth').click();
    await expect(page.locator('.growth-hero')).toContainText(/当前目标/);
    await expect(page.locator('.contract-grid')).toContainText('退休金标准');
    await expect(page.locator('#girl-renew')).toBeEnabled();
    await expect(page.locator('#clinic-heal')).toBeEnabled();
    await expect(page.locator('#clinic-clone')).toBeDisabled();
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
    await expect(page.locator('.av-retired-card')).toHaveCount(1);
    await expect(page.locator('.av-retired-card')).toContainText('退休金');
    await page.locator('#av-market-remote-yue').click();
    await expect(page.locator('.remote-banner')).toContainText('远程联络 · 手机');
    const before = (await stored()).gold;
    await page.locator('#chat-input').fill('退休以后，睡得还好吗？');
    await page.locator('#chat-send').click();
    await expect.poll(async () => (await stored()).gold).toBe(before - 40);
    await page.screenshot({ path: 'artifacts/retired-remote.png', fullPage: true, animations: 'disabled' });
    await close();
  });
  await check('无浏览器错误或失败资源请求', async () => { expect(errors).toEqual([]); expect(failures).toEqual([]); });
} finally {
  fs.writeFileSync('artifacts/browser-results.json', JSON.stringify({ baseURL, results, errors, failures }, null, 2)); await browser.close();
}
