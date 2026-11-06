# CLAUDE.md · 夜糖事务所（night-sugar-office）

> 这份文件是这个仓库的常驻工作说明。动代码之前先读它；里面的命令、边界与风格都是硬约定。

## 这是什么

React 19 + TypeScript + Vite 的单页游戏：玩家经营一家夜里营业的「事务所」，雇佣契约者、处理委托、应付三方势力（星灯协会 / 樱雾市役所 / 月蚀庭）与城市污染。LLM 负责叙事（剧情、新闻、人物档案），本地规则负责结算。

- 分支：`main` 是发布分支；CF Pages 从源码构建，push `main` 即部署
- 本地更新：`update.bat`；开发：`pnpm run dev`
- 存档：优先写本地文件（`/api/kv`），静态部署时自动退回 IndexedDB

## 命令

```bash
node ./node_modules/typescript/bin/tsc --noEmit       # 类型检查（必须无输出）
node tools/check-imports.mjs                          # 依赖门禁：无环、无重复、行数上限、无 BOM
pnpm run build                                        # 产物构建
```

测试（Node 自带 test runner，一次只跑一个文件）：

```bash
node --experimental-strip-types --test-isolation=none --test tests/<name>.test.ts
```

跑全量：

```bash
Get-ChildItem tests/*.test.ts | ForEach-Object {
  node --experimental-strip-types --test-isolation=none --test $_.FullName
}
```

基线：当前 855 项全绿。**任何提交前都要跑一遍全量**，不接受「只跑了我改的那个文件」。

## 工作流（Superpowers）

1. **Plan** — 先写计划（任务、思路、涉及文件、处理/不处理的边界、假设），等用户确认再动手。
2. **Isolate** — 从 `main` 切 `superpowers/[task-slug]` 分支；未经确认不合并。
3. **Test First** — 先写测试并确认它因为「功能还不存在」而失败，再写实现；失败时改代码，不改测试。
4. **Double Review** — 交付前自检两遍：① 是否真的做到了用户要的；② 代码质量（边界、错误处理、可读性、死代码）。
5. 提交信息用英文祈使句；一个批次一个 commit；完成后 push 到 `main`。

## 代码约定

- 注释、UI 文案、提交说明里的叙述一律中文；标识符英文。
- `src/rules/` 下单文件 ≤ 450 行（`check-imports` 会拦），其它文件也尽量别超过 600 行。
- 不允许循环依赖；`check-imports.mjs` 是唯一裁判。
- 文件必须是 **UTF-8 无 BOM**。用 `write` / `edit` 工具写文件；不要用 PowerShell 的 `Set-Content` / `Out-File`（会写 BOM 并破坏构建）。
- 状态更新走 `act(state, action)` 的纯函数 reducer；`App.tsx` 只做编排与副作用。
- 每个数值规则都要能在 `src/balance.ts` 或对应规则模块里找到出处，别把魔法数字散落在组件里。

## 存档与 KV

- 单一 JSON 大文件会撑爆浏览器：**必须按 key 分片**（`data/kv/objects/*.json` + `index.json`）。
- 立绘、卡面这类大块数据走资产引用（`portraitAsset`），存档里只留引用，读档时再取回。
- 本地文件是主存储，浏览器 IndexedDB 是镜像；两边都要能读回，任何一边丢了都不能让玩家丢档。

## 提示词与模型调用

- 提示词只写**真实存在**的信息。找不到人就写「没有」，不要编；这也是 `storyPersonOf` 这类统一解析器存在的原因。
- 角色剧情的主角可能来自三方名册（首领 / 随从），不是只有契约者。
- 叙事长度不做硬性截断；失败就如实报错并保留现场，绝不伪造内容。
- 模型调用统一走 `src/llm.ts`，日志写 `recordLlmLog`（含实际使用的模型名）。

## 界面风格

- 基调：近黑底 + 暗紫细描边 + 粉色高亮（`--pink: #f49abd`），发丝级 1px 分隔线，圆角克制。
- 复用既有类：`.vn-chip`、`.btn`、`.modal-eyebrow`、`.battle-note-*`；**不要引入新色板**。
- 交互必须给反馈：按钮有忙碌态，失败有原因，空状态给出下一步动作。
- VN 模式是可选皮肤，默认仍是「原文」阅读；两者共享同一份数据与同一套动作。

## 已知的重要边界

- `parseStoryLines` 只接受 `cast` 里的人说话；cast 是白名单，也是舞台立绘来源。
- 交互剧情的开场必须先有玩家的 `playerSeed`，App 才会请叙事者起笔。
- 势力场面阵容：首领 + 1 位随从，火气 ≥ 50 时追加对立势力一位代表（`factionSceneCast`）。
- 旧存档可能需要补数据（例如名册外观）：在「编成」里重新确认三方名册即可回填。

## 推送

```powershell
$c = @('protocol=https','host=github.com','','') | & 'G:\Git\ucrt64\bin\git-credential-manager.exe' get
$u = ($c | Where-Object {$_ -like 'username=*'}) -replace 'username=',''
$p = ($c | Where-Object {$_ -like 'password=*'}) -replace 'password=',''
$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${u}:${p}"))
git -c http.sslBackend=openssl -c credential.helper= -c http.extraheader="AUTHORIZATION: basic $basic" push origin HEAD:main
```

`exit code 1` + stderr 里出现 `To https://…` 是成功（PowerShell 把 git 的进度输出当错误流）。
