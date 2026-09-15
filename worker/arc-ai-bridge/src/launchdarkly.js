// LaunchDarkly 客户端流式（SSE）定向改写代理。
//
// 职责：
//   - 校验 Bridge Token。
//   - 仅允许代理固定的 LaunchDarkly 主机（精确白名单，杜绝开放代理 / SSRF）。
//   - 增量解析上游 SSE，只把两个目标开关强制为 value=true / variation=0。
//   - 其他开关、其他事件、注释心跳、id/retry 字段原样（语义等价）透传。
//
// 协议来自 LaunchDarkly 客户端流（clientstream / clientsdk），事件形态需要在
// 受控捕获阶段确认后才能进入正式部署。任何不符合预期的结构都明确失败，
// 不静默兜底、不伪造开关数据。

import { jsonResponse } from "./http.js";
import { SseError, SseParser, serializeEvent } from "./sse.js";
import { tokensEqual } from "./bridge.js";

const encoder = new TextEncoder();

// 只允许这两个精确主机。新增主机必须同时修改 Surge 模块与测试。
export const LD_ALLOWED_HOSTS = new Set([
  "clientstream.launchdarkly.com",
  "clientsdk.launchdarkly.com",
]);

// 目标开关固定集合；除此之外任何 key 都不得修改。
export const TARGET_FLAGS = new Set([
  "ask-in-page-enabled",
  "arc-ai-search-enabled",
]);

// 仅转发真实协议需要的请求头。Host / Content-Length / CF 内部头 / Cookie 一律不转发。
// LaunchDarkly 客户端流通常使用 Authorization（SDK key）或 URL 中的 client-side ID，
// 具体以捕获结果为准；这里保留 authorization 供捕获确认。
const LD_FORWARD_HEADERS = [
  "authorization",
  "accept",
  "user-agent",
  "cache-control",
  "last-event-id",
];

const LD_RESPONSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  "x-content-type-options": "nosniff",
};

const DEFAULT_MAX_EVENT_BYTES = 1024 * 1024;

export class LaunchDarklyError extends Error {}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseEventData(data) {
  if (typeof data !== "string" || data.length === 0) {
    throw new LaunchDarklyError("LaunchDarkly 事件缺少 data");
  }
  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new LaunchDarklyError("LaunchDarkly 事件 data 不是有效 JSON");
  }
  if (!isPlainObject(payload)) {
    throw new LaunchDarklyError("LaunchDarkly 事件 data 必须是 JSON 对象");
  }
  return payload;
}

function pathKey(path) {
  if (typeof path !== "string") return null;
  const segments = path.split("/").filter((segment) => segment.length > 0);
  return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : null;
}

// 在初始化事件里定位 flags 字典。
// 捕获结果（见 CAPTURE.md）：put 的 data 根对象即 flags 字典，没有 data/flags 外层包裹。
// 依次尝试根对象、data、data.flags、flags，并要求两个目标 key 都存在，
// 否则视为协议不符合预期（6.4 节：不得凭空创建未经验证的条目）。
function locateFlagMap(payload) {
  const candidates = [];
  candidates.push(payload);
  if (isPlainObject(payload.data)) {
    candidates.push(payload.data);
    if (isPlainObject(payload.data.flags)) candidates.push(payload.data.flags);
  }
  if (isPlainObject(payload.flags)) candidates.push(payload.flags);
  for (const candidate of candidates) {
    let ok = true;
    for (const key of TARGET_FLAGS) {
      if (!isPlainObject(candidate[key])) {
        ok = false;
        break;
      }
    }
    if (ok) return candidate;
  }
  return null;
}

function forceTarget(flag, key) {
  if (typeof flag.value !== "boolean") {
    throw new LaunchDarklyError(`目标开关 ${key} 的 value 不是布尔值`);
  }
  flag.value = true;
  flag.variation = 0;
}

/**
 * 对单个 SSE 块执行定向改写。
 * 返回新的块（不修改入参）。协议异常时抛出 LaunchDarklyError。
 */
export function rewriteEvent(event) {
  if (event.type === null || event.type === undefined) {
    // 未命名事件（默认 message 类型）不参与改写，原样透传。
    return event;
  }

  if (event.type === "put") {
    const payload = parseEventData(event.data);
    const flags = locateFlagMap(payload);
    if (!flags) {
      throw new LaunchDarklyError("LaunchDarkly 初始化事件缺少目标开关，拒绝改写");
    }
    for (const key of TARGET_FLAGS) forceTarget(flags[key], key);
    return { ...event, data: JSON.stringify(payload) };
  }

  if (event.type === "patch") {
    // 未捕获 patch 的真实结构，保守处理：仅当能明确识别为指向目标开关时才改写，
    // 否则原样透传（不伪造、不终止整条流）。
    let payload;
    try {
      payload = parseEventData(event.data);
    } catch {
      return event;
    }
    const key = pathKey(payload.path);
    if (key !== null && TARGET_FLAGS.has(key) && isPlainObject(payload.data) && typeof payload.data.value === "boolean") {
      payload.data.value = true;
      payload.data.variation = 0;
      return { ...event, data: JSON.stringify(payload) };
    }
    return event;
  }

  if (event.type === "delete") {
    // 未捕获 delete 的真实语义。不伪造 flag、不把 delete 转成 patch，
    // 也不因为一个未确认的事件结构而终止整条流；原样透传，由下一次 put 重新强制。
    return event;
  }

  // 未知事件类型原样透传。
  return event;
}

function targetFields(flag) {
  if (!isPlainObject(flag)) return null;
  const out = {};
  for (const field of ["value", "variation", "version", "flagVersion"]) {
    if (flag[field] !== undefined) out[field] = flag[field];
  }
  return out;
}

// 采集阶段使用的脱敏摘要：只输出事件名、目标 key 以及目标开关的有限字段。
// 不输出完整 URL、请求头、上下文或完整响应正文。
export function summarizeEvent(event) {
  const summary = { event: event.type === null || event.type === undefined ? "message" : event.type };
  if (typeof event.data !== "string" || event.data.length === 0) return summary;
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return { ...summary, data: "unparseable" };
  }
  if (!isPlainObject(payload)) return { ...summary, data: "non-object" };

  const targets = {};
  const collect = (key, flag) => {
    if (TARGET_FLAGS.has(key)) {
      const fields = targetFields(flag);
      if (fields) targets[key] = fields;
    }
  };

  if (event.type === "put" || isPlainObject(payload.flags) || isPlainObject(payload.data)) {
    const map = locateFlagMap(payload) ?? (isPlainObject(payload.data) ? payload.data : null);
    if (map) {
      for (const [key, flag] of Object.entries(map)) collect(key, flag);
    }
  }
  if (isPlainObject(payload.data) && typeof payload.path === "string") {
    collect(pathKey(payload.path) ?? "", payload.data);
  }
  if (Object.keys(targets).length > 0) summary.targets = targets;
  else summary.targets = {};
  return summary;
}

// 结构探针：只输出键名/层级/数量，绝不输出 flag 取值或上下文。
function describePut(block) {
  try {
    const payload = JSON.parse(block.data);
    const flags = locateFlagMap(payload);
    let path = null;
    if (flags === payload) path = "<root>";
    else if (isPlainObject(payload.data) && flags === payload.data) path = "data";
    else if (isPlainObject(payload.flags) && flags === payload.flags) path = "flags";
    else if (isPlainObject(payload.data) && isPlainObject(payload.data.flags) && flags === payload.data.flags) path = "data.flags";
    const sampleKey = flags ? Object.keys(flags)[0] : null;
    return {
      stage: "put-structure",
      topKeys: Object.keys(payload),
      dataIsObject: isPlainObject(payload.data),
      dataKeys: isPlainObject(payload.data) ? Object.keys(payload.data).slice(0, 6) : null,
      flagsPath: path,
      flagCount: flags ? Object.keys(flags).length : 0,
      sampleEntryKeys: sampleKey && isPlainObject(flags[sampleKey]) ? Object.keys(flags[sampleKey]) : null,
      targetEntryKeys: flags && isPlainObject(flags["ask-in-page-enabled"]) ? Object.keys(flags["ask-in-page-enabled"]) : null,
    };
  } catch (error) {
    return { stage: "put-structure-error", message: String(error?.message ?? error) };
  }
}

/**
 * 把上游 SSE 正文转换为增量输出流。
 * mutate 为 true 时执行定向改写；为 false 时仅透传（采集阶段）。
 */
export function createLaunchDarklyStream(upstreamBody, options = {}) {
  if (!upstreamBody) throw new LaunchDarklyError("LaunchDarkly 上游没有响应正文");
  const mutate = options.mutate !== false;
  const observe = Boolean(options.observe);
  const maxEventBytes = options.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES;
  const log = options.log ?? ((line) => console.log(line));
  const debug = options.debug ?? null;

  return new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      const parser = new SseParser({ maxEventBytes });
      let blockCount = 0;
      const handle = (blocks) => {
        for (const block of blocks) {
          if (debug && blockCount < 30) {
            debug({ stage: "block", index: blockCount, type: block.type, dataBytes: block.data ? block.data.length : 0 });
            if (block.type === "put" && typeof block.data === "string") debug(describePut(block));
            blockCount += 1;
          }
          const next = mutate ? rewriteEvent(block) : block;
          if (observe) log(JSON.stringify(summarizeEvent(next)));
          controller.enqueue(encoder.encode(serializeEvent(next)));
        }
      };
      try {
        for (;;) {
          const read = await reader.read();
          if (read.done) {
            handle(parser.end());
            break;
          }
          handle(parser.feed(read.value ?? new Uint8Array()));
        }
        controller.close();
      } catch (error) {
        controller.error(error instanceof Error ? error : new Error(String(error)));
      }
    },
    cancel(reason) {
      return upstreamBody.cancel?.(reason);
    },
  });
}

function resolveTarget(url) {
  const raw = url.searchParams.get("target");
  if (!raw) throw new LaunchDarklyError("缺少 target 参数");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new LaunchDarklyError("target 不是合法 URL");
  }
  if (parsed.protocol !== "https:") throw new LaunchDarklyError("target 必须是 HTTPS");
  if (parsed.username || parsed.password) throw new LaunchDarklyError("target 不得包含凭据");
  if (parsed.port && parsed.port !== "443") throw new LaunchDarklyError("target 端口不受支持");
  if (!LD_ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new LaunchDarklyError("target 主机不在 LaunchDarkly 白名单内");
  }
  return parsed;
}

export async function handleLaunchDarklyStream(request, env, url) {
  if (!(await tokensEqual(request.headers.get("x-arc-bridge-token"), env.BRIDGE_TOKEN))) {
    return jsonResponse(401, "桥接访问令牌无效");
  }

  let target;
  try {
    target = resolveTarget(url);
  } catch (error) {
    return jsonResponse(422, error.message);
  }

  const headers = new Headers();
  for (const name of LD_FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("accept", "text/event-stream");

  // 临时诊断：仅在 LD_DEBUG=1 时输出阶段/状态/内容类型，不含 URL、query 或请求头取值。
  const debug = env.LD_DEBUG === "1" ? (payload) => console.log(`[ld-debug] ${JSON.stringify(payload)}`) : null;
  debug?.({ stage: "request", method: request.method, host: target.hostname, hasAuth: headers.has("authorization") });

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
      redirect: "manual",
    });
  } catch (error) {
    debug?.({ stage: "fetch-failed", message: String(error?.message ?? error) });
    return jsonResponse(502, "无法连接 LaunchDarkly 上游");
  }
  debug?.({
    stage: "upstream",
    status: upstream.status,
    type: upstream.headers.get("content-type"),
    hasBody: Boolean(upstream.body),
  });
  if (!upstream.ok) {
    return jsonResponse(502, `LaunchDarkly 上游返回 HTTP ${upstream.status}`);
  }
  if (!upstream.headers.get("content-type")?.toLowerCase().includes("text/event-stream")) {
    return jsonResponse(502, "LaunchDarkly 上游未返回 SSE");
  }

  // 两个独立开关：
  //   - LD_CAPTURE=1：对本次连接输出脱敏摘要（采集阶段），不改变行为；
  //   - LD_REWRITE=1：启用正式定向改写。
  // 未设置 LD_REWRITE 时端点只透传，保证「未捕获不部署改写」。
  const observe = env.LD_CAPTURE === "1";
  const rewriteEnabled = env.LD_REWRITE === "1";
  const mutate = rewriteEnabled;
  // 采集摘要带固定前缀，便于把 wrangler tail 的原始输出过滤为「仅脱敏摘要」，
  // 避免把完整 URL / 请求头写入任何捕获文件。
  const log = (line) => console.log(`[ld-capture] ${line}`);

  let body;
  try {
    body = createLaunchDarklyStream(upstream.body, {
      mutate,
      observe,
      log,
      debug,
      maxEventBytes: env.LD_MAX_EVENT_BYTES ? Number(env.LD_MAX_EVENT_BYTES) : DEFAULT_MAX_EVENT_BYTES,
    });
  } catch (error) {
    return jsonResponse(502, error instanceof SseError ? error.message : "LaunchDarkly 响应流初始化失败");
  }

  return new Response(body, {
    status: 200,
    headers: { ...LD_RESPONSE_HEADERS, "x-arc-ld-mode": mutate ? "rewrite" : "passthrough" },
  });
}
