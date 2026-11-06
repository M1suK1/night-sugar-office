# 方案 v163 · Boss 专属技能不再漏给非 Boss 单位（只做边界）

## TASK

`boss-*` 技能按设计「只挂在 Boss 单位上，不进少女 / 魔物的公共池子」，但目前内容包导入后，普通魔物与装备也能带上它们。修掉这条漏路，Boss 模板保持可用。

## 问题定位

- `src/content/library.ts:482` 把 `bossSkillById` 并进了唯一的 `skillPool`，本意是让 Boss 模板能引用；
  但这个池子同时传给了 `sanitizeMonster` 与 `sanitizeItem`。
- 结果：内容包 / 合并 / 读档 / 存档 / 导出都会接受 `skillIds: ['boss-…']` 的普通魔物，
  以及 `skillId: 'boss-…'` 的装备；装备技能会在 `unitFromGirl` 里直接进战斗技能表。
- `src/rules/candidate.ts` 的 `sanitizeCustomLeader` / `sanitizeCustomGirl` 对 `skillIds` 只做字符串过滤，
  存档里被写入的 boss 技能也会原样保留。

## APPROACH

1. **内容库拆池**：`sanitizeLibrary` 拆两个池——`publicPool`（公共池 + 本包自定义技能）给装备与魔物，
   `bossPool`（publicPool + `bossSkillById`）只给 `sanitizeBoss`。导入、合并、`loadLibrary`、`saveLibrary`、导出全部走这里。
2. **名册清洗**：`sanitizeCustomLeader` / `sanitizeCustomGirl` 的 `skillIds` / `skills` 增加 `!isBossSkill(id)` 过滤。
   只排除 boss，不要求必须存在于公共池，避免自定义技能尚未 `applyLibrary` 时误删。

按用户选择，本次不加战斗层兜底（`unitFromMonster` / `unitFromGirl` 不改）。

## FILES

| 文件 | 改动 |
| --- | --- |
| `src/content/library.ts` | `sanitizeLibrary` 拆 public / boss 两个技能池 |
| `src/rules/candidate.ts` | 两个 `sanitizeCustom*` 过滤 `isBossSkill` |
| `tests/v163.test.ts` | 新增用例（见下） |
| `package.json` | `test` 列表加入 `tests/v163.test.ts` |
| `tasks/todo.md` | 记 v163 |

## 测试

1. 内容包里的普通魔物带 `boss-sugar-crown`：清洗后该 id 被丢掉，公共技能保留。
2. 普通魔物的技能全是不合法项（含 boss）：回落 `monster-claw`。
3. 装备带 `skillId: 'boss-sugar-crown'`：清洗后 `skillId` 为 `undefined`；公共技能仍保留。
4. Boss 模板阶段引用 `boss-sugar-crown`：仍能通过 `sanitizeLibrary`。
5. 包内自定义技能（非 boss）仍可挂到魔物与装备上。
6. `readContentPack` 导入路径同样丢弃普通魔物的 boss 技能。
7. Leader / 随从的 `skillIds` / `skills` 清洗后不含 boss 技能。

## EDGE IN

- 内容包导入、合并、读取、保存、导出全路径。
- Boss 模板与 Boss 副本仍可正常使用 boss 技能。
- 只排除 `boss-*`，自定义技能与公共技能不受影响。

## EDGE OUT

- 不加战斗层兜底：修复前已经物化进 `state.customMonsters` / 装备的 boss 技能不会被追溯清除。
- 不限制「魔物只能用魔物系技能」——流派仍然只是标签（v162 的设计不变）。
- 不限制 Boss 阶段只能使用 `boss-*` 技能（Boss 用公共技能现状保留；要收紧另开一版）。
- 不碰 `data/` 下的玩家数据。

## ASSUME

「修复 Boss 技能」= Boss 专属技能不应出现在非 Boss 单位上，而不是「Boss 只能用 Boss 技能」。
