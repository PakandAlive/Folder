// arc-ai-bridge Worker 路由入口。
//
// 路由：
//   GET  /health               健康检查
//   POST /capture              Arc Ask on Page -> 自定义 OpenAI 兼容上游
//   GET  /launchdarkly-stream  LaunchDarkly SSE 定向改写代理
//
// /health 与 /capture 的行为必须与部署版本保持一致，改动前先跑 test/bridge.test.js。

import { jsonResponse } from "./http.js";
import { handleCapture } from "./bridge.js";
import { handleLaunchDarklyStream } from "./launchdarkly.js";

export { buildOpenAIPayload, createAnthropicStream, handleCapture } from "./bridge.js";
export { rewriteEvent, createLaunchDarklyStream, TARGET_FLAGS } from "./launchdarkly.js";
export { SseParser } from "./sse.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", service: "arc-ai-bridge" });
    }
    if (request.method === "POST" && url.pathname === "/capture") {
      return handleCapture(request, env, url);
    }
    if (request.method === "GET" && url.pathname === "/launchdarkly-stream") {
      return handleLaunchDarklyStream(request, env, url);
    }
    return jsonResponse(404, "Not Found");
  },
};
