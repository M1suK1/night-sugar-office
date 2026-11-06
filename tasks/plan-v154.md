# 方案 v154 · 控制台：市场契约 / 好感 / 等级

## TASK

给 CMD 终端加三条调试命令：

1. `contract <名字>`（合并原 `contract` 与计划的 `hire`）：**先搜市场池**（`state.candidates`），
   找不到再搜契约卡库；从市场池契约时等级固定 1。不再单独提供 `hire`。
2. `bond <名字> <0–100>`：设置一位**已契约**少女的好感度。
3. `level <名字> <1–10>`：设置一位**已契约**少女的等级，四维与血量按自动升级方案重算。

## APPROACH

- 三条命令都走正常 reducer（clone → 校验 → 日志），和现有 `contract` / `remove` / `witch` 一致，不绕过存档清洗。
- `contract` 改成两段查找：
  1. `state.candidates` 里按 id / 全名 / 代号 / 片段找 → 命中就走「候选 → 名册」：免费、不看席位、等级压回 1
     （用 `baseStatsAt` 回推基准，和 `reset` 同一套），同时把该候选记进 `marketSold` 并刷新货架窗口，避免同一个人再次挂牌；
  2. 没命中再走原来的卡库流程（`loadCardBox` → `cardboxCards` → `debugContractCard`）。
  返回消息里标清来源是「市场池」还是「契约卡库」。
- `level` 的核心写成纯函数 `setGirlLevel(girl, target)`（放 `progression.ts`，可测）：
  1. 用 `baseStatsAt(stats, level, archetype)` 把当前四维回推到 1 级基准；
  2. 按自动升级逐级加：主属性 +6 / 副属性 +4（上限 120），每级 `baseMaxHp` +10；
  3. `recomputeMaxHp` 处理疤痕削减，`maxSpirit = effectiveGuard`，`exp` 清零；
  4. 等级夹在 1–10；已经是目标等级时只报错不动。
- `bond` 直接夹 0–100 并写日志。

## FILES

| 文件 | 改动 |
| --- | --- |
| `src/types.ts` | 新增两个 `GameAction`：`debugSetBond` / `debugSetLevel`；市场契约复用扩展后的 `debugContractCard` 或新增 `debugContractCandidate` |
| `src/progression.ts` | 新增纯函数 `setGirlLevel(girl, level)` |
| `src/rules/debugOps.ts` | 三个 action 的处理器（含日志） |
| `src/rules/act.ts` | 分发三个新 action |
| `src/App.tsx` | 命令解析 + help 文案 |
| `tests/v154.test.ts` | 等级换算、好感夹取、市场契约 |
| `package.json` | 加测试 |

## EDGE IN

- 名字匹配：id / 全名 / 代号 / 名字片段，取第一个匹配。
- 市场池里没有这个人 → 回落到卡库；两处都没有 → 明确报错并说明搜过哪里。
- 同名同时出现在市场池与卡库 → **市场池优先**。
- 市场池候选原本是高级招聘来的（等级 >1）→ 契约时也压回 Lv.1。
- 等级 1 / 10、好感 0 / 100 边界；非法数字（`abc`、`1.5`、`0`、`11`）拒绝。
- 目标等级等于当前等级 → 提示「已经是 Lv.N」。
- 契约时席位已满：**仍然允许**（调试命令，与 `contract` 一致）。
- 出勤中 / 休息中的少女：允许改等级与好感（调试），不改状态。

## EDGE OUT

- 不改市场刷新、收费、席位与 `marketSold` 的正式逻辑（`hire` 只是调试通道）。
- 不支持批量（一次一个名字）；不保留独立的 `hire` 命令。
- 不给候选池里的候选者改好感/等级（要求是「已契约」）。
- 不新增界面面板，只做终端命令。

## ASSUME

- 「市场池」= `state.candidates`（所有候选，不只是货架上那两位）。
- `hire` 免费、不看席位，与现有 `contract` 的调试语义一致。
- 「自动升级方案」= `grantExp` 的 `auto`：主 +6、副 +4、HP +10/级；设定等级相当于从 1 级自动升到目标级。
- 设定等级会清空当前经验（`exp = 0`）。

确认后我开 `superpowers/v154-console`，先写测试。
