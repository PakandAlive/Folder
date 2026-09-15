// Surge 请求脚本：把 Arc 的 LaunchDarkly 客户端流（SSE）请求转发到 Cloudflare Worker。
//
// 与 arc-ai-bridge.js 相互独立，互不影响。
//
// 设计约束（对应方案第 8 节）：
//   1. 从模块参数读取 BRIDGE_TOKEN，不硬编码。
//   2. 通过查询参数安全传递原始目标 URL。
//   3. 添加 X-Arc-Bridge-Token。
//   4. 只传递 Worker 代理 LaunchDarkly 所必需的请求信息。
//   5. 不使用 Surge 本地持久化存储，不打印完整 URL、请求头或上下文。
//   6. 未配置 token 时明确返回错误，不访问官方上游或 Worker。
//
// 注意：LaunchDarkly 客户端流可能需要 Authorization（SDK key），此处不删除，
// 与 Arc AI 请求脚本的删除策略不同。是否需要转发以受控捕获结果为准。

const WORKER_ORIGIN = "https://arc-ai-bridge.upcore-a98.workers.dev";
const WORKER_ENDPOINT = `${WORKER_ORIGIN}/launchdarkly-stream`;

// 不转发到 Worker 的请求头：Cookie、Host、长度、Cloudflare 内部头与代理头。
const BLOCKED_HEADERS = new Set([
  "cookie",
  "host",
  "content-length",
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "cf-ipcountry",
  "cf-ray",
  "cf-worker",
  "x-forwarded-for",
  "x-real-ip",
  "proxy-authorization",
]);

const parameters = {};
for (const item of ($argument || "").split("&")) {
  if (!item) continue;
  const [name, ...valueParts] = item.split("=");
  parameters[decodeURIComponent(name)] = decodeURIComponent(valueParts.join("="));
}

const bridgeToken = parameters.BRIDGE_TOKEN;

if (!bridgeToken) {
  $done({
    response: {
      status: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Arc LaunchDarkly Bridge 未配置 BRIDGE_TOKEN" }),
    },
  });
} else {
  const headers = {};
  for (const [name, value] of Object.entries($request.headers || {})) {
    if (!BLOCKED_HEADERS.has(name.toLowerCase())) headers[name] = value;
  }
  headers["X-Arc-Bridge-Token"] = bridgeToken;
  headers["Accept"] = "text/event-stream";

  const target = encodeURIComponent($request.url);

  $done({
    url: `${WORKER_ENDPOINT}?target=${target}`,
    headers,
  });
}
