const WORKER_URL = "https://arc-ai-bridge.upcore-a98.workers.dev";

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
      body: JSON.stringify({ error: "Arc AI Bridge 未配置 BRIDGE_TOKEN" }),
    },
  });
} else {
  const sensitiveHeaders = new Set([
    "authorization",
    "cookie",
    "proxy-authorization",
    "x-api-key",
    "api-key",
    "host",
    "content-length",
  ]);

  const headers = {};
  for (const [name, value] of Object.entries($request.headers || {})) {
    if (!sensitiveHeaders.has(name.toLowerCase())) headers[name] = value;
  }
  headers["X-Arc-Bridge-Token"] = bridgeToken;
  headers.Accept = "text/event-stream";
  headers["Content-Type"] = "application/json";

  const target = encodeURIComponent($request.url);
  $done({
    url: `${WORKER_URL}/capture?target=${target}`,
    headers,
    body: $request.body,
  });
}
