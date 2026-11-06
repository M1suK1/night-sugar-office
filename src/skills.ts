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

/**
 * 给程序生成（非手写）的少女挑三条技能（v162）。
 *
 * 以前按职阶写死三套，同职阶的人拿到的技能一模一样。现在从整个公共池里抽：
 * 一基础 / 一本职 / 一奥义，优先她的元素流派，但允许抽到「通用」与「魔物」技能。
 * 用种子保证同一份候选刷新前后一致，不同候选之间又不会重样。
 */
export function pickCandidateSkills(seed: number, element?: string): string[] {
  const pool = girlSkillPool();
  const rng = mulberry32(seed >>> 0);
  const tiers: SkillTier[] = ['basic', 'signature', 'ultimate'];
  const picked: string[] = [];
  for (const tier of tiers) {
    const all = pool.filter(skill => skill.tier === tier);
    if (!all.length) continue;
    const themed = element ? all.filter(skill => skill.school === element) : [];
    // 六成走元素流派，其余全池抽——「通用」「魔物」技能才有机会进来。
    const source = themed.length && rng() < 0.6 ? themed : all;
    const choice = source[Math.min(source.length - 1, Math.floor(rng() * source.length))]!;
    if (!picked.includes(choice.id)) picked.push(choice.id);
  }
  for (const skill of pool) {
    if (picked.length >= 3) break;
    if (!picked.includes(skill.id)) picked.push(skill.id);
  }
  return picked.slice(0, 3);
}
