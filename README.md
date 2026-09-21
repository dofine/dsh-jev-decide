# dsh-jev-decide

[![npm version](https://img.shields.io/npm/v/dsh-jev-decide.svg)](https://www.npmjs.com/package/dsh-jev-decide)
[![license](https://img.shields.io/npm/l/dsh-jev-decide.svg)](./LICENSE)
[![DSH 插件市场](https://img.shields.io/badge/DSH-插件市场-blue)](https://awesome-dsh-plugin.com/)

把 [TypeSafe Jev](https://docs.typesafe.ai/)（"System One" 决策模型）接入 DSH：注册一个 agent 工具 **`jev_decide`**，让 agent 用校准过的概率做判断，而不是让对话模型凭感觉猜。Jev 不生成文本，只对 `state` 回答类型化问题：

| type | 问法 | 返回 |
| --- | --- | --- |
| `noul` | 是/否问题 | `answer` = 是的概率 0..1 |
| `choice` | 从 `options` 里挑一个（≥2） | `answer` = 选中项 + `probabilities` 全分布 + `confidence` |
| `score` | 按 `levels` 有序打分（≥2） | `answer` = 概率加权分值 + 分布 + `confidence` |

适合：紧急度分级、意图路由、guardrail 检查、二选一、按 rubric 打分。

## 安装

```sh
dsh plugin --profile web add github:dofine/dsh-jev-decide     # 本仓库 0.1.2
dsh plugin --profile web add link:/path/to/source             # 本地源码（先在源码目录跑一次 npm install 物化 peer）
```

本包声明了 `dsh.bundle.patch`，`add` 会自动把它写进 profile 的 `dsh.profile.bundles`，并加载仓库里的 `cordis.patch.yml` —— 不需要手改 profile。**重启 DSH 生效**（host 插件在进程启动时装配）。

> 若你曾按旧版说明手写过一行 insert，删掉它，否则同一个插件会挂两次（重复 id）。

## 凭据

按序取第一个非空值：

1. 插件配置 `apiKey`（cordis patch 的 `config:`，或 `$DSH_HOME/plugins/dsh-jev-decide/config.json`）
2. 环境变量 `TYPESAFE_API_KEY`
3. DSH 凭据存储：`~/.dsh/.credentials.yaml` 里 `refs.TYPESAFE_AI_API_KEY`（插件经 `ctx.credentials` 读取）

## 工具签名

```
jev_decide({
  state: string,            // 必填，要评估的内容（纯文本）
  question: string,         // 必填，要做的判断
  type?: 'noul' | 'choice' | 'score',   // 默认 noul
  options?: string[],       // type=choice 时必填（≥2）
  levels?: string[],        // type=score 时必填（≥2，从低到高）
  model?: string,           // 默认 jev-latest（当前 jev-1.13.0）
}) → { model, type, answer, confidence?, probabilities?, usage }
```

## 配置

`$DSH_HOME/plugins/dsh-jev-decide/config.json` 或 cordis patch 的 `config:`：

```json
{ "model": "jev-latest", "timeoutMs": 15000, "baseUrl": "https://api.typesafe.ai/v1" }
```

## 开发

```sh
npm install   # 顺带物化 peer @deepseek-ai/dsh-tools
npm test      # node --test：密钥优先级、空白值、异常兜底、fetch 桩端到端
```

## 说明

- 单文件零构建（纯 ESM），只消费 `defineTool` 一个纯函数，不要求宿主注入 peer
- 429/529 做一次 1s 短退避重试（共 2 次尝试）
- 定价：$0.042/百万输入 token，输出免费；限流 250k tok/s、1200 req/min（[模型页](https://docs.typesafe.ai/models)）
- 同类项目：[noetion/dsh-jev](https://github.com/noetion/dsh-jev)（一次问多题 + skill）、[kaijia323/dsh-plugin-jev](https://github.com/kaijia323/dsh-plugin-jev)（双传输）、[buberlo/dsh-jev](https://github.com/buberlo/dsh-jev)、[zhangxaochen/dsh-jev](https://github.com/zhangxaochen/dsh-jev)
