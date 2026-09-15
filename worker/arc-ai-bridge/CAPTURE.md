# LaunchDarkly SSE 受控捕获报告（脱敏）

捕获时间：2026-09-15 19:54 – 20:10（本机 Arc + Surge + Worker 链路）
捕获方式：`Arc → Surge MITM → Worker /launchdarkly-stream（passthrough + 脱敏摘要）`
记录范围：仅响应类型、事件名、目标开关的有限字段；不含完整 URL、请求头、上下文或完整响应正文。

## 1. 端点与请求

```text
方法：GET
主机：clientstream.launchdarkly.com
路径：/meval/<base64 编码的评估上下文>
必需请求头：Authorization（客户端 SDK key）、Accept: text/event-stream
```

结论：**必须转发 `Authorization`**（与 Arc AI 请求脚本的删除策略相反）。

## 2. 初始化事件（已确认）

```text
SSE 事件名：put
data：单行 JSON
结构：根对象即 flags 字典，没有 data/flags 外层包裹
规模：849 个 flag，约 138,728 字节
```

单条 flag 条目的字段名（仅字段名，不含取值）：

```text
version, flagVersion, value, variation, trackEvents, trackReason, debugEventsUntilDate
```

两个目标开关在 `put` 中的实际字段：

```text
ask-in-page-enabled   : value=false, variation=1, version=947, flagVersion=10
arc-ai-search-enabled : value=false, variation=1, version=947, flagVersion=2
```

## 3. 心跳

```text
周期出现无事件名的注释块（SSE comment），data 为空。
```

## 4. 尚未观察到的事件

```text
patch  ：未在本捕获窗口内出现
delete ：未在本捕获窗口内出现
```

Arc 的 LD 长连接会周期性重连，每次重连都会重发完整的 `put`。

## 5. 对实现的影响

1. `put` 改写：根对象即 flags 字典；对两个目标 key 设 `value=true`、`variation=0`，其余字段保留。
2. `Authorization` 必须转发（Surge 脚本不得删除）。
3. `patch` / `delete` 的真实结构未确认，相关处理必须保守：
   仅在能明确识别时才改写，识别不了就原样透传，不得伪造。
4. 上游返回 `text/event-stream; charset=utf-8`，探测未带授权时返回 `400 application/json`。

## 6. 复现方法

```bash
# 1. 设 LD_CAPTURE=1（只读采集，不改写）、LD_DEBUG=1（阶段诊断）
# 2. 启动 wrangler tail，并用 tools/filter-tail.py 过滤为「仅脱敏摘要」：
script -q /dev/null npx wrangler tail --format json 2>/dev/null \
  | python3 tools/filter-tail.py >> capture.log

# 3. 重启 Arc，触发 LaunchDarkly 建流
# 4. 采集完成后把 LD_CAPTURE 设回 0，并删除 LD_DEBUG
```

`tools/filter-tail.py` 只保留 Worker `console.log` 中以 `[ld-capture]` 开头的行；
`wrangler tail` 原始输出中的完整 URL、查询参数与请求头一律丢弃，不写入捕获文件。
（注意：`wrangler tail` 的日志字段 `message` 是数组，过滤器必须同时处理数组与字符串。）
