# 方案 v162 · 生成的少女不再固定三条技能

## 问题

- `makeCandidate` 按职阶写死三套技能，同职阶所有人完全一样。
- `storyRun` 的故事同伴固定 `glimmer-spear / peach-ward / starlight-fall`。
- LLM 起草的补位逻辑会从技能池开头补，看起来还是同几条。
- 通用（8 条）与魔物（14 条）技能虽然在公共池里，却几乎不会进入程序生成的少女。

## 修法

新增 `pickCandidateSkills(seed, element)`：

- 从完整公共池（52 条，含通用 / 魔物）里抽 **一基础 / 一本职 / 一奥义**；
- 六成优先元素流派，四成全池抽取，保证通用与魔物技能有出场机会；
- 种子确定性：同一候选刷新不变，不同候选组合不同；
- 接入 `makeCandidate`、故事同伴、LLM 起草的缺省补位。

## 文件

| 文件 | 改动 |
| --- | --- |
| `src/skills.ts` | 新增 `pickCandidateSkills` |
| `src/rules/candidate.ts` | `makeCandidate` 改用抽取 |
| `src/rules/storyRun.ts` | 故事同伴改用抽取 |
| `src/llm.ts` | 起草缺技能时按元素抽取，不再补池子开头 |
| `tests/v162.test.ts` | 档位、确定性、通用/魔物覆盖、候选不再重样 |

内置初始角色（月见桃等）的固定技能保持不变。
