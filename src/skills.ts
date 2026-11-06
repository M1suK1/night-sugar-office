import type { Skill, SkillTier } from './types';
import { skills, skillById } from './content/skills.ts';
import { bossSkillById, bossSkills } from './content/bossSkills.ts';
import { mulberry32 } from './content/archetypes.ts';

/**
 * 技能池的取用口。
 *
 * 一个池子，不分家：`girlSkillPool()` 与 `monsterSkillPool()` 返回的是同一份 50 条，
 * 只是名字点明了用途。`school` 是流派标签，不是权限；`side` 才决定这条技能能打谁。
 * Boss 技能单独成池，任何非 Boss 单位都拿不到。
 */

/** 少女与魔物共用的公共池（不含 Boss）。 */
export function girlSkillPool(): Skill[] {
  return skills.filter(skill => skill.tier !== 'boss');
}

/** 与 `girlSkillPool()` 同一份内容，名字点明魔物也在用。 */
export function monsterSkillPool(): Skill[] {
  return girlSkillPool();
}

/** Boss 专属池。 */
export function bossSkillPool(): Skill[] {
  return [...bossSkills];
}

/** 按流派取技能；传空字符串或「全部」返回整个公共池。 */
export function skillsOfSchool(school: string | undefined): Skill[] {
  const pool = girlSkillPool();
  if (!school || school === '全部') return pool;
  return pool.filter(skill => skill.school === school);
}

/** 按阶级取技能；`boss` 只从 Boss 池里取。 */
export function skillsOfTier(tier: SkillTier | undefined): Skill[] {
  if (tier === 'boss') return bossSkillPool();
  if (!tier) return girlSkillPool();
  return girlSkillPool().filter(skill => skill.tier === tier);
}

/** 同时按流派与阶级筛选，给自定义登记与内容工坊用。 */
export function filterSkills(options: { school?: string; tier?: SkillTier | 'all' } = {}): Skill[] {
  const tier = options.tier && options.tier !== 'all' ? options.tier : undefined;
  return skillsOfSchool(options.school).filter(skill => !tier || skill.tier === tier);
}

/** 任何池子里的技能都能按 id 找到；Boss 技能也在内。 */
export function findAnySkill(id: string | undefined): Skill | undefined {
  if (!id) return undefined;
  return skillById.get(id) ?? bossSkillById.get(id);
}

/** 自治内容的校验用：某个 id 是否属于 Boss 池。 */
export function isBossSkill(id: string | undefined): boolean {
  return Boolean(id && bossSkillById.has(id));
}

/** 公共池里是否有这个 id（用来判断自定义少女的三个技能是否合法）。 */
export function isPoolSkill(id: string | undefined): boolean {
  return Boolean(id && skillById.has(id) && skillById.get(id)!.tier !== 'boss');
}

/** 某条技能是不是被动。 */
export function isPassiveSkill(id: string | undefined): boolean {
  return Boolean(id && skillById.get(id)?.tier === 'passive');
}

/** 保留第一条被动，丢掉后面的；其余技能原样保留。 */
export function takeOnePassive(ids: readonly string[]): string[] {
  let kept = false;
  return ids.filter(id => {
    if (!isPassiveSkill(id)) return true;
    if (kept) return false;
    kept = true;
    return true;
  });
}

/**
 * 给程序生成（非手写）的少女挑三条技能（v164）。
 *
 * - 三成概率带一条被动，本流派优先，其次通用；
 * - 其余位置从主动里按阶级权重抽（基础 55 / 本职 30 / 奥义 15），六成优先本流派；
 * - 最多 1 条被动，且不会抽成三条同阶级；
 * - 种子确定：同一份候选刷新前后一致，不同候选之间又不会重样。
 */
export function pickCandidateSkills(seed: number, element?: string): string[] {
  const pool = girlSkillPool();
  const actives = pool.filter(skill => skill.tier !== 'passive');
  const passives = pool.filter(skill => skill.tier === 'passive');
  const rng = mulberry32(seed >>> 0);
  const picked: string[] = [];
  const push = (id: string) => {
    if (picked.length >= 3 || picked.includes(id)) return;
    if (isPassiveSkill(id) && picked.some(isPassiveSkill)) return;
    picked.push(id);
  };

  if (rng() < 0.3) {
    const themed = element ? passives.filter(skill => skill.school === element) : [];
    const generic = passives.filter(skill => skill.school === '通用');
    // 六成走本流派被动，其余从通用里挑；元素没有专属被动时也落到通用。
    const source = themed.length && rng() < 0.6 ? themed : (generic.length ? generic : passives);
    if (source.length) push(source[Math.min(source.length - 1, Math.floor(rng() * source.length))]!.id);
  }

  let guard = 0;
  while (picked.length < 3 && guard < 40) {
    guard += 1;
    const tiers = picked.map(id => skillById.get(id)?.tier);
    const tooMany = tiers.filter(tier => tier === 'ultimate').length >= 2
      ? 'ultimate'
      : tiers.filter(tier => tier === 'basic').length >= 2 ? 'basic' : undefined;
    const themed = element ? actives.filter(skill => skill.school === element) : [];
    const source = (themed.length && rng() < 0.6 ? themed : actives)
      .filter(skill => !picked.includes(skill.id) && skill.tier !== tooMany);
    if (!source.length) break;
    const weights = source.map(skill => (skill.tier === 'basic' ? 55 : skill.tier === 'signature' ? 30 : 15));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = rng() * total;
    let choice = source[source.length - 1]!;
    for (let index = 0; index < source.length; index += 1) {
      roll -= weights[index]!;
      if (roll <= 0) { choice = source[index]!; break; }
    }
    push(choice.id);
  }

  for (const skill of [...actives, ...pool]) {
    if (picked.length >= 3) break;
    push(skill.id);
  }
  return picked.slice(0, 3);
}
