# arc-ai-bridge Worker

Arc Ask on Page 的 Cloudflare Worker 桥接，以及 LaunchDarkly 客户端流（SSE）定向改写代理。

## 来源说明

`src/bridge.js`（原有 `/capture` 逻辑）由生产部署产物反打包得到，行为与部署版本
`235cdcde-daac-4d0d-a039-b836da632ac3`（部署 ID `fa1a1df0-f920-420b-8d46-00ae03ec55be`）保持一致，
仅做去压缩与模块拆分。它不是重新实现。

`src/sse.js`、`src/launchdarkly.js` 为本次新增，用于 LaunchDarkly 定向改写。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 `{ "status": "ok", "service": "arc-ai-bridge" }` |
| POST | `/capture` | Arc AI 请求 → 自定义 OpenAI 兼容上游 → Anthropic SSE |
| GET | `/launchdarkly-stream` | LaunchDarkly SSE 定向改写代理 |

## 绑定

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `API_URL` | plain_text | 自定义 OpenAI 兼容上游地址（配置在 Cloudflare，不入库） |
| `MODEL` | plain_text | 上游模型名 |
| `STREAM_CHUNK_CHARACTERS` | plain_text | 文本分片长度 |
| `STREAM_CHUNK_DELAY_MS` | plain_text | 分片延迟 |
| `BRIDGE_TOKEN` | secret_text | Surge 与 Worker 之间共享的桥接令牌 |
| `UPSTREAM_API_KEY` | secret_text | 上游 API Key |
| `LD_CAPTURE` | plain_text（可选） | 设为 `1` 时允许 `?observe=1` 的脱敏采集模式 |
| `LD_REWRITE` | plain_text（可选） | 设为 `1` 时才启用正式定向改写；未设置时只透传 |

`wrangler.jsonc` 使用 `keep_vars: true`，部署不会覆盖已在仪表盘配置的变量与 Secret。

## LaunchDarkly 定向改写

- 只允许 `clientstream.launchdarkly.com`、`clientsdk.launchdarkly.com` 两个精确主机。
- 只修改两个开关：`ask-in-page-enabled`、`arc-ai-search-enabled`，强制 `value=true`、`variation=0`。
- 其他开关、其他事件、注释心跳、`id`/`retry` 字段原样（语义等价）透传。
- 协议不符合预期时通过 `controller.error()` 明确终止，不静默兜底、不伪造开关数据。

### 采集模式

设置 `LD_CAPTURE=1` 后，每次连接都会向 `wrangler tail` 输出脱敏摘要
（事件名 + 目标开关的 `value`/`variation`/`version`/`flagVersion`），不改变任何行为。

```json
{"event":"put","targets":{"ask-in-page-enabled":{"value":false,"variation":1,"version":947,"flagVersion":10}}}
```

### 安全闸门

响应头 `x-arc-ld-mode` 明确标识当前模式：

- `passthrough`：`LD_REWRITE` 未设为 `1`，端点只透传，不做任何改写。
- `rewrite`：`LD_REWRITE=1`，执行定向改写。

捕获阶段确认前保持 `passthrough`，确认后再设置 `LD_REWRITE=1`。

采集阶段确认后才可部署正式改写。

## 相关文档

- `CAPTURE.md`：LaunchDarkly SSE 协议受控捕获报告（脱敏）。
- `tools/filter-tail.py`：把 `wrangler tail` 输出过滤为「仅脱敏摘要」。
- `tools/filter-diag.py`：链路诊断过滤（只输出方法、路径、状态码与脱敏摘要）。

## 测试

```bash
npm run syntax
npm test
```

覆盖：原有 `/capture` 回归、SSE 增量解析（CRLF/LF、多行 `data:`、注释心跳、跨 chunk 的 UTF-8）、
定向改写（只改两个开关、其他开关深度相等）、协议异常终止、白名单与令牌校验。

## 待确认事项（捕获阶段）

以下必须在真实捕获后确认，当前代码按公开协议形态实现，未确认前不部署：

1. 初始化事件的实际事件名与 flags 字典路径。
2. 增量事件名与路径表达。
3. 是否需要转发 `Authorization`。
4. 单个事件的版本字段语义（`version` / `flagVersion`）与是否需要在改写时提升 `version`，
   否则客户端 SDK 可能丢弃改写后的事件。
5. 上游是否对响应做完整性签名；若签名存在，改写会导致校验失败。
