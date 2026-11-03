import { readFileSync, writeFileSync } from 'node:fs';

// ---------- 1. missions.ts：抽难度时以模板档位为锚点 ----------
const file = 'src/rules/missions.ts';
let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

s = s.replace(
  `export function pickDifficulty(state: GameState, district: DistrictId, missionId: string): DifficultyTier {
  const level = clampPollution(state.pollution?.[district] ?? 0);
  const weights: Record<DifficultyTier, number> = difficultyWeights(level);
  const order: DifficultyTier[] = ['低危', '中危', '高危', '绝望'];
  let roll = hashText(\`\${missionId}:difficulty\`) % 100;
  for (const tier of order) {
    roll -= weights[tier];
    if (roll < 0) return tier;
  }
  return '低危';
}`,
  `export function pickDifficulty(state: GameState, district: DistrictId, missionId: string, baseline?: DifficultyTier): DifficultyTier {
  const level = clampPollution(state.pollution?.[district] ?? 0);
  const weights: Record<DifficultyTier, number> = difficultyWeights(level);
  const order: DifficultyTier[] = ['低危', '中危', '高危', '绝望'];
  // 模板写的档位是锚点：辖区污染只在这一档上下浮动一档。
  // 不带锚点时才按旧行为全区间抽——「高危模板在干净辖区变成低危」就是这里缺了锚点。
  const anchor = baseline ? order.indexOf(baseline) : -1;
  const usable = order.map((tier, index) => ({ tier, weight: anchor < 0 || Math.abs(index - anchor) <= 1 ? weights[tier] : 0 }));
  const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return baseline ?? '低危';
  let roll = hashText(\`\${missionId}:difficulty\`) % total;
  for (const entry of usable) {
    roll -= entry.weight;
    if (roll < 0) return entry.tier;
  }
  return baseline ?? '低危';
}

/** 委托的实际危险度与模板基线不同时，给界面一句说明；一致时返回 undefined。 */
export function missionBaselineNote(mission: Pick<Mission, 'difficulty' | 'scaledFrom'>): string | undefined {
  if (!mission.scaledFrom || mission.scaledFrom === mission.difficulty) return undefined;
  return \`模板基线 \${mission.scaledFrom}\`;
}`,
);

s = s.replace(
  `  // v24：难度由这一片辖区自己的污染度抽，再反向缩放模板。
  // 模板里写的 \`difficulty\` 只是基线，工坊预览与故事线套用才会用到它。
  const difficulty = template.storylineId ? template.difficulty as DifficultyTier : pickDifficulty(state, regionId, id);`,
  `  // v24：难度由这一片辖区自己的污染度抽，再反向缩放模板；
  // 但模板写的 \`difficulty\` 是锚点——辖区污染只能在它上下浮动一档，
  // 否则同一张「高危」模板会在干净辖区变成「低危」，地图和工坊里看到的是两个数。
  const baseline = DIFFICULTY_SCALE[template.difficulty as DifficultyTier] ? template.difficulty as DifficultyTier : undefined;
  const difficulty = template.storylineId ? baseline ?? '中危' : pickDifficulty(state, regionId, id, baseline);`,
);

writeFileSync(file, s);

// ---------- 2. MissionDialog / DispatchMap：显示模板基线 ----------
let md = readFileSync('src/components/MissionDialog.tsx', 'utf8').replace(/\r\n/g, '\n');
md = md.replace(
  `        <span className={\`pill work-\${mission.work}\`}>{mission.difficulty}</span>`,
  `        <span className={\`pill work-\${mission.work}\`}>{mission.difficulty}</span>
        {baselineNote && <small className="mission-baseline-note">{baselineNote}</small>}`,
);
if (!md.includes('missionBaselineNote')) {
  md = md.replace(
    `import { statueWith` ,
    `import { statueWith`,
  );
}
writeFileSync('src/components/MissionDialog.tsx', md);

console.log('missions + dialog patched');
