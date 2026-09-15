// Arc Ask on Page AI 桥接（现有 /capture 逻辑）。
//
// 本文件由 Cloudflare 生产部署产物反打包得到，行为保持与部署版本
// `235cdcde-daac-4d0d-a039-b836da632ac3` 逐字一致，仅做去压缩与模块拆分。
// 任何改动都必须先补充 test/bridge.test.js 的回归测试。

import { jsonResponse } from "./http.js";

const encoder = new TextEncoder();

export const ALLOWED_TARGETS = new Set([
  "https://aiproxy.diabrowser.engineering/api/dia-claude-stream",
  "https://webresultproxy.diabrowser.engineering/api/claude-stream",
]);

export class BridgeError extends Error {}

// Arc Ask on Page 模板里与「极简」相关的措辞（捕获自 Arc 客户端请求体，见 CAPTURE 阶段记录）。
// 仅在 ASK_STRIP_CONCISE=1 时应用；匹配不到就原样保留，不做任何猜测性改写。
const ASK_CONCISE_RULES = [
  {
    pattern: /Then,\s+summarize the answer in 10 words on the next line\./g,
    replacement:
      "Then, give a complete explanation in your own words, with as much detail as the question needs.",
  },
  {
    pattern: /Be extremely concise\.\s*\(1-sentence answers if possible\)\./g,
    replacement: "Be thorough. Give the question the detail it deserves instead of the shortest possible answer.",
  },
];

export function patchArcPromptText(text) {
  let out = text;
  let replacements = 0;
  for (const rule of ASK_CONCISE_RULES) {
    out = out.replace(rule.pattern, () => {
      replacements += 1;
      return rule.replacement;
    });
  }
  return { text: out, replacements };
}

export function countAskConciseRules(text) {
  return patchArcPromptText(text).replacements;
}

// 临时门控：AI_CAPTURE=1 时输出 prompt 结构摘要与 system prompt 全文，
// 不记录 user/assistant 正文（其中含网页内容与用户提问）。
const AI_CAPTURE_PREFIX = "[ai-capture]";
const AI_CAPTURE_MAX_SYSTEM_CHARS = 8000;
const AI_CAPTURE_EDGE_CHARS = 1500;

export function summarizeArcPrompt(arcPayload, options = {}) {
  const includeUserContent = Boolean(options.includeUserContent);
  const edgeChars = Number.isInteger(options.edgeChars) && options.edgeChars > 0 ? options.edgeChars : AI_CAPTURE_EDGE_CHARS;
  const summary = {
    payloadKeys: null,
    feature: null,
    isDev: null,
    model: null,
    sampling: {},
    tools: null,
    messages: [],
    systemChars: 0,
    system: null,
  };
  if (!arcPayload || typeof arcPayload !== "object" || Array.isArray(arcPayload)) return summary;

  summary.payloadKeys = Object.keys(arcPayload).sort();
  for (const key of ["feature", "isDev", "model"]) {
    if (arcPayload[key] !== undefined) summary[key] = arcPayload[key];
  }
  for (const key of ["temperature", "top_p", "max_tokens", "stop_sequences"]) {
    if (arcPayload[key] !== undefined) summary.sampling[key] = arcPayload[key];
  }
  if (arcPayload.tools !== undefined) {
    summary.tools = Array.isArray(arcPayload.tools) ? arcPayload.tools.length : "non-array";
  }

  const prompt = Array.isArray(arcPayload.prompt) ? arcPayload.prompt : [];
  for (const message of prompt) {
    const blocks = Array.isArray(message?.content) ? message.content : [];
    const text = blocks.map((block) => (typeof block?.text === "string" ? block.text : "")).join("");
    const entry = {
      role: message?.role ?? null,
      blocks: blocks.length,
      blockTypes: [...new Set(blocks.map((block) => block?.type ?? null))],
      chars: text.length,
    };
    // 仅在显式开启时输出非 system 消息的首尾片段（中间省略），避免整体落盘页面正文。
    if (includeUserContent && entry.role !== "system" && text.length > 0) {
      if (text.length <= edgeChars * 2) {
        entry.head = text;
        entry.tail = "";
        entry.omitted = 0;
      } else {
        entry.head = text.slice(0, edgeChars);
        entry.tail = text.slice(-edgeChars);
        entry.omitted = text.length - entry.head.length - entry.tail.length;
      }
    }
    summary.messages.push(entry);
  }

  const system = prompt
    .filter((message) => message?.role === "system")
    .map((message) =>
      (Array.isArray(message.content) ? message.content : [])
        .map((block) => (typeof block?.text === "string" ? block.text : ""))
        .join(""),
    )
    .join("\n\n=== system message boundary ===\n\n");
  if (system.length > 0) {
    summary.systemChars = system.length;
    summary.system =
      system.length > AI_CAPTURE_MAX_SYSTEM_CHARS
        ? `${system.slice(0, AI_CAPTURE_MAX_SYSTEM_CHARS)}...<truncated>`
        : system;
  }
  return summary;
}

export async function upstreamErrorResponse(upstream) {
  const contentType = upstream.headers.get("content-type") || "";
  const body = await upstream.text();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(body));
  const bodySha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const title = body.match(/<title>([^<]{1,200})<\/title>/i)?.[1] || null;
  return Response.json(
    {
      error: `上游 API 返回 HTTP ${upstream.status}`,
      upstream: {
        content_type: contentType,
        server: upstream.headers.get("server"),
        cf_ray: upstream.headers.get("cf-ray"),
        body_sha256: bodySha256,
        html_title: title,
      },
    },
    { status: 502 },
  );
}

export async function tokensEqual(received, expected) {
  if (!received || !expected) return false;
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function textContent(content) {
  if (!Array.isArray(content)) {
    throw new BridgeError("消息 content 必须是文本块数组");
  }
  return content
    .map((block) => {
      if (!block || block.type !== "text" || typeof block.text !== "string") {
        throw new BridgeError("当前仅支持 type=text 的消息内容");
      }
      return block.text;
    })
    .join("");
}

export function buildOpenAIPayload(arcPayload, model, options = {}) {
  const stripConcise = options.stripConcise === true;
  if (!arcPayload || typeof arcPayload !== "object" || Array.isArray(arcPayload)) {
    throw new BridgeError("Arc 请求正文必须是 JSON 对象");
  }
  if (!Array.isArray(arcPayload.prompt) || arcPayload.prompt.length === 0) {
    throw new BridgeError("Arc 请求缺少非空 prompt 数组");
  }
  if (
    arcPayload.tools !== undefined &&
    (!Array.isArray(arcPayload.tools) || arcPayload.tools.length !== 0)
  ) {
    throw new BridgeError("当前不支持 Arc 工具调用");
  }
  const messages = arcPayload.prompt.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw new BridgeError("prompt 中的元素必须是对象");
    }
    if (!["system", "user", "assistant"].includes(message.role)) {
      throw new BridgeError(`当前不支持消息角色：${message.role}`);
    }
    const text = textContent(message.content);
    return {
      role: message.role,
      content: stripConcise ? patchArcPromptText(text).text : text,
    };
  });
  const result = { model, messages, stream: true, stream_options: { include_usage: true } };
  for (const key of ["temperature", "top_p", "max_tokens"]) {
    if (arcPayload[key] !== undefined) result[key] = arcPayload[key];
  }
  if (arcPayload.stop_sequences !== undefined) result.stop = arcPayload.stop_sequences;
  return result;
}

function sseEvent(type, data) {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

function splitText(text, chunkCharacters) {
  const characters = Array.from(text);
  const chunks = [];
  for (let offset = 0; offset < characters.length; offset += chunkCharacters) {
    chunks.push(characters.slice(offset, offset + chunkCharacters).join(""));
  }
  return chunks;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createAnthropicStream(upstreamBody, options) {
  if (!upstreamBody) throw new BridgeError("上游 API 没有响应正文");
  const chunkCharacters = Number(options.chunkCharacters);
  const chunkDelayMs = Number(options.chunkDelayMs);
  if (!Number.isInteger(chunkCharacters) || chunkCharacters <= 0) {
    throw new BridgeError("STREAM_CHUNK_CHARACTERS 必须是正整数");
  }
  if (!Number.isInteger(chunkDelayMs) || chunkDelayMs < 0) {
    throw new BridgeError("STREAM_CHUNK_DELAY_MS 必须是非负整数");
  }
  return new ReadableStream({
    async start(controller) {
      const enqueue = (type, data) => controller.enqueue(sseEvent(type, data));
      try {
        enqueue("message_start", {
          type: "message_start",
          message: {
            id: "msg_arc_ai_bridge",
            type: "message",
            role: "assistant",
            content: [],
            model: options.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
        enqueue("content_block_start", {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        });
        const reader = upstreamBody.getReader();
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let buffer = "";
        let finishReason = "end_turn";
        let outputTokens = 0;
        const processLine = async (line) => {
          const normalized = line.trim();
          if (!normalized || normalized.startsWith("event:")) return false;
          if (!normalized.startsWith("data:")) {
            throw new BridgeError("上游流包含非 SSE data 行");
          }
          const data = normalized.slice(5).trim();
          if (data === "[DONE]") return true;
          const event = JSON.parse(data);
          if (!event || typeof event !== "object" || Array.isArray(event)) {
            throw new BridgeError("上游 SSE data 必须是 JSON 对象");
          }
          if (Number.isInteger(event.usage?.completion_tokens)) {
            outputTokens = event.usage.completion_tokens;
          }
          if (!Array.isArray(event.choices) || event.choices.length === 0) return false;
          const choice = event.choices[0];
          if (!choice || typeof choice !== "object" || !choice.delta || typeof choice.delta !== "object") {
            throw new BridgeError("上游 choices[0].delta 格式错误");
          }
          if (choice.delta.tool_calls !== undefined && choice.delta.tool_calls !== null) {
            if (!Array.isArray(choice.delta.tool_calls) || choice.delta.tool_calls.length !== 0) {
              throw new BridgeError("当前不支持上游工具调用");
            }
          }
          if (choice.delta.content !== undefined && choice.delta.content !== null) {
            if (typeof choice.delta.content !== "string") {
              throw new BridgeError("上游 delta.content 必须是字符串");
            }
            for (const fragment of splitText(choice.delta.content, chunkCharacters)) {
              enqueue("content_block_delta", {
                type: "content_block_delta",
                index: 0,
                delta: { type: "text_delta", text: fragment },
              });
              if (chunkDelayMs > 0) await delay(chunkDelayMs);
            }
          }
          if (choice.finish_reason === "length") finishReason = "max_tokens";
          else if (![null, undefined, "stop"].includes(choice.finish_reason)) {
            throw new BridgeError(`当前不支持上游结束原因：${choice.finish_reason}`);
          }
          return false;
        };
        let done = false;
        while (!done) {
          const read = await reader.read();
          buffer += decoder.decode(read.value || new Uint8Array(), { stream: !read.done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (await processLine(line)) {
              done = true;
              break;
            }
          }
          if (read.done) {
            if (buffer && (await processLine(buffer))) done = true;
            break;
          }
        }
        enqueue("content_block_stop", { type: "content_block_stop", index: 0 });
        enqueue("message_delta", {
          type: "message_delta",
          delta: { stop_reason: finishReason, stop_sequence: null },
          usage: { output_tokens: outputTokens },
        });
        enqueue("message_stop", { type: "message_stop" });
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function handleCapture(request, env, url) {
  if (!(await tokensEqual(request.headers.get("x-arc-bridge-token"), env.BRIDGE_TOKEN))) {
    return jsonResponse(401, "桥接访问令牌无效");
  }
  if (request.headers.has("authorization") || request.headers.has("cookie")) {
    return jsonResponse(400, "Surge 未删除 Arc 认证头，拒绝转发");
  }
  const target = url.searchParams.get("target");
  if (!target || !ALLOWED_TARGETS.has(target)) {
    return jsonResponse(422, "不支持的 Arc 目标地址");
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1024 * 1024) return jsonResponse(413, "请求正文超过 1 MiB");
  let arcPayload;
  try {
    arcPayload = await request.json();
  } catch {
    return jsonResponse(400, "Arc 请求正文不是有效 JSON");
  }
  if (env.AI_CAPTURE === "1") {
    // 临时诊断：只输出结构摘要与 system prompt，不输出 user/assistant 正文。
    try {
      console.log(
        `${AI_CAPTURE_PREFIX} ${JSON.stringify(
          summarizeArcPrompt(arcPayload, {
            includeUserContent: env.AI_CAPTURE_USER === "1",
            edgeChars: env.AI_CAPTURE_EDGE_CHARS ? Number(env.AI_CAPTURE_EDGE_CHARS) : undefined,
          }),
        )}`,
      );
      if (env.ASK_STRIP_CONCISE === "1") {
        let replacements = 0;
        for (const message of Array.isArray(arcPayload?.prompt) ? arcPayload.prompt : []) {
          for (const block of Array.isArray(message?.content) ? message.content : []) {
            if (typeof block?.text === "string") replacements += countAskConciseRules(block.text);
          }
        }
        console.log(`${AI_CAPTURE_PREFIX} {"patch":"strip-concise","replacements":${replacements}}`);
      }
    } catch {
      // 诊断日志失败不得影响正常转发。
    }
  }
  let upstreamPayload;
  try {
    upstreamPayload = buildOpenAIPayload(arcPayload, env.MODEL, {
      stripConcise: env.ASK_STRIP_CONCISE === "1",
    });
  } catch (error) {
    return jsonResponse(422, error.message);
  }
  const upstream = await fetch(env.API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.UPSTREAM_API_KEY}`,
      "content-type": "application/json",
      accept: "text/event-stream",
      "user-agent": "Arc-AI-Bridge/1.0",
    },
    body: JSON.stringify(upstreamPayload),
  });
  if (!upstream.ok) return upstreamErrorResponse(upstream);
  if (!upstream.headers.get("content-type")?.toLowerCase().includes("text/event-stream")) {
    return jsonResponse(502, "上游 API 未返回 SSE");
  }
  let body;
  try {
    body = createAnthropicStream(upstream.body, {
      model: env.MODEL,
      chunkCharacters: env.STREAM_CHUNK_CHARACTERS,
      chunkDelayMs: env.STREAM_CHUNK_DELAY_MS,
    });
  } catch (error) {
    return jsonResponse(502, error.message);
  }
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}
