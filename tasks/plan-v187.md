# 方案 v187 · 天气变化（季节已拆分到下一版）

TASK
  给夜糖加一层确定性的天气：每夜三段，影响委托目标、报酬、疲劳、精神力与战斗，
  并作为**事实**写进提示词，让叙事与数值是同一场雨。季节本轮不做。

APPROACH
  1. **不新增存档字段**：天气由 `(day, 段号)` 哈希算出，段号由营业分钟推出（20:00 / 22:00 / 00:00 三段）。
     零迁移；同存档同夜同段必得同一结果；模型只能顺着写，不能改天气。
  2. 天气复用 `DistrictEffect` 形状，在 `missionSnapshot()`（src/rules/missions.ts:113）并进
     `mission.environment`。目标/报酬/战斗/疲劳全部走现有快照，不新增结算分支。
  3. 天气在**委托生成时冻结**（与辖区、污染一致）。委托卡按 `mission.spawnedAt` 还原发布时天气。
  4. 提示词：新增 `{{weather}}` 宏 + 一条共用分区「环境·天气」，预设 schema 7 → 8 自动补齐；
     正文只给体感与写法约束，不给数值，不替模型预报。
  5. 视觉克制：顶栏 chip、地图一层遮罩、委托详情一行天气。只有雨与雪位移，
     `prefers-reduced-motion` 下全静止。

  天气表（权重归一化；强度可在数值规则里调）

  | 天气 | 权重 | 修正 |
  |---|---|---|
  | 薄雾（默认晴） | 40 | 无 |
  | 雨 | 18 | 调查目标 +4%，造成伤害 −4%，疲劳 +2 |
  | 浓雾 | 16 | 调查目标 +6%，敌人生命 −6%，每小时精神 −1 |
  | 风 | 12 | 造成伤害 +6%，疲劳 +1 |
  | 雪 | 8 | 疲劳 +3，承受伤害 +5% |
  | 雷暴 | 6 | 造成伤害 +8%，承受伤害 +8%，报酬 +12% |

FILES
  · src/weather.ts                 新增：天气表、waveOf、weatherOf、weatherEffect、提示词文本
  · src/balance.ts                 weatherIntensity 旋钮（0–200，默认 100）
  · src/rules/missions.ts          missionSnapshot 合成天气
  · src/rules/battle.ts            spiritDrain 读快照
  · src/promptMacros.ts            {{weather}} 宏
  · src/promptSections.ts          共用分区「环境·天气」
  · src/presets.ts                 PRESET_SCHEMA 7 → 8
  · src/components/Shell.tsx       顶栏天气与下一段预告
  · src/components/DispatchMap.tsx 地图天气层与 chip
  · src/components/MissionDialog.tsx 发布时天气
  · src/map.css / src/styles.css   天气视觉
  · tests/v187.test.ts / package.json / tasks/todo.md

EDGE IN
  三段天气与确定性取法；并入委托快照（目标、报酬、伤害、敌人生命、疲劳、精神流失）；
  顶栏 / 地图 / 委托详情可见；提示词注入；旧档缺 spawnedAt 回退第 0 段；平衡强度旋钮。

EDGE OUT
  季节、节日、月相；天气对市场与事件池权重的重排；玩家手动改天气；音效与逐帧粒子；
  不改战斗随机种子；不改辖区与污染公式本身。

ASSUME
  00:00–02:00 属前一夜，沿用第三段；单项天气修正 ≤12%，低于辖区最大单项；
  强度旋钮只缩放数值，不改变天气种类。
