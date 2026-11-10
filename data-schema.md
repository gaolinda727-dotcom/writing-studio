# 数据与模板约定

数据文件采用 UTF-8 JSON。`course.json` 保存任务；`scaffolds.json` 以任务 ID 为键保存写前支架。构建脚本将它们写入 HTML 中的 `writingCatalog` 和 `writingScaffolds`，学生打开成品时不再读取外部 JSON。

## `data/course.json`

```json
{
  "version": 1,
  "title": "Writing Studio",
  "application": [],
  "continuationGroups": [
    {"id": "self", "title": "人与自我", "description": "个人选择与成长", "items": []},
    {"id": "society", "title": "人与社会", "description": "关系、理解与善意", "items": []},
    {"id": "nature", "title": "人与自然", "description": "生命与自然", "items": []}
  ]
}
```

上方是结构示意，空数组不是可直接交付的题库。当前示例为 14 道应用文与 13 道续写。

### 每个任务的字段

| 字段 | 类型 | 约定 |
| --- | --- | --- |
| `id` | string | 全部任务中唯一的稳定标识，推荐小写 ASCII 字母、数字与连字符 |
| `type` | string | `application` 或 `continuation` |
| `genre` | string | 应用文文体，或续写具体子主题 |
| `group` | string | 应用文使用空字符串；续写使用所属主题语境名称 |
| `name` | string | 写作区完整显示名，如“邀请信 · 校园英语节” |
| `title` | string | 首页题目短名 |
| `summary` | string | 1—2 句中文任务概述 |
| `short` | string | “应用文”或“读后续写” |
| `max` | number | 当前教学参考总分，应用文 15、续写 25 |
| `target` | number | 当前任务目标词数，如 80 或 150 |
| `time` | number | 建议完成时间，单位分钟 |
| `prompt` | string | 完整任务要求；可用 `\n` 分段 |
| `checklist` | string[] | 三条审题核对，围绕对象、要点、线索等任务理解 |
| `dimensions` | array | `[维度名称, 分值]` 的数组；各项分值之和等于 `max` |
| `sample` | string | 当前题目的预设示例作品，供演示反馈及互评使用 |
| `feedback` | object | 针对该示例作品的预设反馈，字段见下文 |

`feedback` 字段：

```json
{
  "snippet": "I want you to come and be a judge.",
  "heading": "让邀请语气更得体",
  "explanation": "把直接要求改成礼貌请求，清楚说明受邀角色。",
  "before": "I want you to come and be a judge.",
  "after": "Would you be willing to join us as a judge?"
}
```

`before` 应确实出现在 `sample` 中；`snippet` 应来自同一题目的示例。续写 `prompt` 必须包含可读的原文和两段首句标识 `Paragraph 1:`、`Paragraph 2:`。

## `data/scaffolds.json`

顶层是以任务 ID 为键的对象，每个课程任务应有对应支架：

```json
{
  "invitation": {
    "focus": "准确告知活动信息，以礼貌语气邀请对方承担具体角色。",
    "framework": [
      {"label": "说明邀请目的", "guidance": "点明活动与写信目的。"},
      {"label": "交代安排与角色", "guidance": "说明时间、地点、内容和受邀角色。"},
      {"label": "期待回复", "guidance": "询问是否方便参加，并表达期待。"}
    ],
    "patterns": [
      {"phrase": "I am writing to invite you to [event].", "usage": "交代邀请目的。"},
      {"phrase": "The event will take place at [place] on [date].", "usage": "说明时间地点。"},
      {"phrase": "Would you be willing to [role or action]?", "usage": "提出礼貌请求。"}
    ],
    "analysis": {
      "question": "哪种措辞更适合邀请外教担任评委？",
      "options": ["You must come.", "Would you be willing to serve as a judge?", "Do not be late."],
      "answer": 1,
      "explanation": "礼貌请求让对方能够判断是否方便，也说明了受邀角色。"
    },
    "transferPrompt": "列出活动信息与受邀角色，再试写一条自己的邀请句。"
  }
}
```

约定：`framework` 为 3—4 项，`patterns` 为 3 项；`analysis.options` 为 3 项，`answer` 是从 0 开始的正确选项索引。所有说明与选项必须对应当前题目，不能给海报、日记或续写统一套用邀请信支架。

## 模板占位符

`assets/template.html` 需保留以下占位符，构建时一次性替换：

| 占位符 | 写入内容 |
| --- | --- |
| `{{STUDIO_CSS}}` | 内联样式 |
| `{{STUDIO_DATA}}` | `const writingCatalog` 课程数据 |
| `{{STUDIO_SCAFFOLDS}}` | `const writingScaffolds` 支架数据 |
| `{{STUDIO_AUTH}}` | 预打包本机账号及备份逻辑 |
| `{{STUDIO_APP}}` | 学习流程与交互逻辑 |

成品不得残留占位符，也不能依赖读取同级脚本或 JSON 文件。模板保留现有 DOM ID 和账号模块接口；仅改数据时无需改模板。

## 学习记录边界

课程与支架数据不包含学生账号或作答。学生记录保存在其浏览器中，按本机账号和 `task-{id}-…` 等键分别管理。分享成品或提交 GitHub 不会自动提交这些记录。

同名账号导出的学习备份只用于个人记录恢复，不是课程文件。不要把学生备份、账号数据库或密码摘要写入 `course.json`、`scaffolds.json` 或仓库。
