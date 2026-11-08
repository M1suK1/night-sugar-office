# 方案 v191 · 让叙事者自己选视觉小说的背景

TASK
  视觉小说的背景图已经全部导入（九块辖区 + 四个房间），但提示词从没要求模型写背景：
  回看/演出时挂哪张图，只由事件 id 的哈希或会议地点决定，所以背景和剧情对不上。
  要改成：写这一段剧情时，叙事者顺便把背景选出来。

APPROACH
  1. 背景是一段剧情一个（`CharacterEvent.backdrop`），可选字段，不迁移老档；
     `vn/backdrops.ts` 补上 `BACKDROP_IDS`、`isBackdropId`、`backdropChoicesText`。
  2. 清单走宏 `{{backdrops}}`（13 个 id + 中文名），提示词里不写死；
     以后加背景只改 backdrops.ts，契约与蓝图分区自动跟着变。
  3. 三处生成要求写 `backdrop`：
     · 蓝图 event 节点（sl-nodes）；
     · 交互剧情开场白（arcOpeningContract → generateStoryOpening）；
     · 私人事件（generateEvent 的 JSON 形状）与分幕剧情（arcContract）。
     每处都写明「必须和 narration 里写的地点一致，室内用 room:*，街区用辖区 id」。
  4. 本地校验：只认 `BACKDROP_IDS` 里的 id，写错就当没写，回落到旧规则。
  5. 取图优先级：会议地点（系统事实）> 模型选的 backdrop > 旧 scenes.scene > 按 id 稳定分辖区。
  6. 归档副本也存 backdrop，回看时不会又换成另一块地。

FILES
  · src/vn/backdrops.ts                 背景清单、isBackdropId、优先级
  · src/types.ts                        CharacterEvent / event 节点 / startStorySession / beginStoryEvent 加 backdrop
  · src/storygraph.ts                   蓝图草稿只收合法 id
  · src/rules/storyRun.ts               蓝图事件落地时带上背景
  · src/rules/storyOps.ts               开场与分幕两处动作写入背景
  · src/promptSections.ts               sl-nodes、arcOpeningContract、arcContract
  · src/promptMacros.ts                 {{backdrops}} 宏
  · src/llm.ts                          三个生成器解析并返回 backdrop
  · src/App.tsx                         把 background 接到事件创建
  · src/storyArchive.ts                 归档与回放保留背景
  · tests/v191.test.ts                  6 条
  · package.json / tasks/plan-v191.md / tasks/todo.md

EDGE IN
  · 非法 / 缺失 id 一律忽略，保留旧行为；老档、老副本不迁移
  · 会议地点优先于模型选择（约谈、会议不会被改成别的辖区）
  · 蓝图草稿、开场白、私人事件、分幕剧情四条路都覆盖
  · 归档 → 回看 保留同一张背景

EDGE OUT
  · 不做「一段剧情内换场景」：一张背景管整段，多场景切换要动舞台节拍，另开一版
  · 不给蓝图编辑器加背景下拉框（模型写、程序校验；手改图暂时不提供）
  · 不改战斗札记与突发弹窗的背景

ASSUME
  「背景和剧情对不上」指演出/回看时挂的图与文字里的地点不一致；
  背景只做氛围，不参与任何数值与判定。
