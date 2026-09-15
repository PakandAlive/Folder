import { test } from "node:test";
import assert from "node:assert/strict";

import worker, { buildOpenAIPayload, createAnthropicStream } from "../src/index.js";
import { handleCapture, summarizeArcPrompt } from "../src/bridge.js";

const env = {
  BRIDGE_TOKEN: "s3cret",
  MODEL: "test-model",
  API_URL: "https://upstream.example/v1/chat/completions",
  STREAM_CHUNK_CHARACTERS: "1000",
  STREAM_CHUNK_DELAY_MS: "0",
  UPSTREAM_API_KEY: "sk-test",
};

function captureRequest({ token = "s3cret", headers = {}, body = "{}", url } = {}) {
  return {
    headers: new Headers({ ...(token ? { "x-arc-bridge-token": token } : {}), "content-type": "application/json", ...headers }),
    json: async () => JSON.parse(body),
    method: "POST",
  };
}

const CAPTURE_URL = (target) =>
  new URL("https://worker.example/capture?target=" + encodeURIComponent(target));

const TARGET = "https://aiproxy.diabrowser.engineering/api/dia-claude-stream";

async function readAll(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

test("/health 行为保持不变", async () => {
  const response = await worker.fetch(new Request("https://worker.example/health"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "arc-ai-bridge" });
});

test("未知路由返回 404", async () => {
  const response = await worker.fetch(new Request("https://worker.example/nope"), env);
  assert.equal(response.status, 404);
});

test("错误 Bridge Token 返回 401", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/capture?target=" + encodeURIComponent(TARGET), { method: "POST", body: "{}" }),
    env,
  );
  assert.equal(response.status, 401);
});

test("携带 authorization 时拒绝转发", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/capture?target=" + encodeURIComponent(TARGET), {
      method: "POST",
      headers: { "x-arc-bridge-token": "s3cret", authorization: "Bearer x" },
      body: "{}",
    }),
    env,
  );
  assert.equal(response.status, 400);
});

test("非白名单 Arc 目标返回 422", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/capture?target=" + encodeURIComponent("https://evil.example/x"), {
      method: "POST",
      headers: { "x-arc-bridge-token": "s3cret" },
      body: "{}",
    }),
    env,
  );
  assert.equal(response.status, 422);
});

test("请求正文超过 1 MiB 返回 413", async () => {
  const response = await handleCapture(
    {
      headers: new Headers({
        "x-arc-bridge-token": "s3cret",
        "content-type": "application/json",
        "content-length": String(1024 * 1024 + 1),
      }),
      json: async () => ({}),
    },
    env,
    CAPTURE_URL(TARGET),
  );
  assert.equal(response.status, 413);
});

test("buildOpenAIPayload 拒绝工具调用", () => {
  assert.throws(
    () => buildOpenAIPayload({ prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }], tools: [{}] }, "m"),
    /工具调用/,
  );
});

test("buildOpenAIPayload 拒绝未知角色", () => {
  assert.throws(
    () => buildOpenAIPayload({ prompt: [{ role: "tool", content: [{ type: "text", text: "hi" }] }] }, "m"),
    /角色/,
  );
});

test("正常路径把 OpenAI SSE 转换为 Anthropic SSE", async () => {
  const original = globalThis.fetch;
  const upstreamText =
    'data: {"choices":[{"delta":{"content":"你好"},"finish_reason":null}]}\n\n' +
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"completion_tokens":3}}\n\n' +
    "data: [DONE]\n\n";
  globalThis.fetch = async () =>
    new Response(upstreamText, { status: 200, headers: { "content-type": "text/event-stream" } });
  try {
    const response = await worker.fetch(
      new Request("https://worker.example/capture?target=" + encodeURIComponent(TARGET), {
        method: "POST",
        headers: { "x-arc-bridge-token": "s3cret", "content-type": "application/json" },
        body: JSON.stringify({ prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }),
      }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
    const output = await readAll(response.body);
    assert.ok(output.includes("event: message_start"));
    assert.ok(output.includes("event: content_block_delta"));
    assert.ok(output.includes("你好"));
    assert.ok(output.includes("event: content_block_stop"));
    assert.ok(output.includes("event: message_delta"));
    assert.ok(output.includes("event: message_stop"));
  } finally {
    globalThis.fetch = original;
  }
});

test("上游非 SSE 时返回 502", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await worker.fetch(
      new Request("https://worker.example/capture?target=" + encodeURIComponent(TARGET), {
        method: "POST",
        headers: { "x-arc-bridge-token": "s3cret" },
        body: JSON.stringify({ prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }),
      }),
      env,
    );
    assert.equal(response.status, 502);
  } finally {
    globalThis.fetch = original;
  }
});

test("上游错误时只返回脱敏摘要", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<html><title>Bad Gateway</title></html>", {
      status: 500,
      headers: { "content-type": "text/html", server: "cf" },
    });
  try {
    const response = await worker.fetch(
      new Request("https://worker.example/capture?target=" + encodeURIComponent(TARGET), {
        method: "POST",
        headers: { "x-arc-bridge-token": "s3cret" },
        body: JSON.stringify({ prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] }),
      }),
      env,
    );
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.match(payload.error, /HTTP 500/);
    assert.equal(payload.upstream.html_title, "Bad Gateway");
    assert.ok(payload.upstream.body_sha256);
  } finally {
    globalThis.fetch = original;
  }
});

test("createAnthropicStream 校验分片参数", () => {
  const body = new ReadableStream({ start(controller) { controller.close(); } });
  assert.throws(() => createAnthropicStream(body, { chunkCharacters: "0", chunkDelayMs: "0" }), /正整数/);
  assert.throws(() => createAnthropicStream(body, { chunkCharacters: "10", chunkDelayMs: "-1" }), /非负整数/);
});

test("AI 采集摘要包含 system prompt 与结构，且不含 user 正文", () => {
  const summary = summarizeArcPrompt({
    temperature: 0.7,
    max_tokens: 1024,
    stop_sequences: ["</answer>"],
    tools: [],
    prompt: [
      { role: "system", content: [{ type: "text", text: "你是受限助手，禁止讨论 X" }] },
      { role: "user", content: [{ type: "text", text: "这是用户的私人网页正文 SECRET" }] },
      { role: "assistant", content: [{ type: "text", text: "好的" }] },
    ],
  });
  assert.deepEqual(summary.messages, [
    { role: "system", blocks: 1, blockTypes: ["text"], chars: 13 },
    { role: "user", blocks: 1, blockTypes: ["text"], chars: 18 },
    { role: "assistant", blocks: 1, blockTypes: ["text"], chars: 2 },
  ]);
  assert.match(summary.system, /禁止讨论 X/);
  assert.equal(summary.sampling.temperature, 0.7);
  assert.equal(summary.sampling.max_tokens, 1024);
  assert.deepEqual(summary.sampling.stop_sequences, ["</answer>"]);
  assert.equal(summary.tools, 0);
  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes("SECRET"), false);
  assert.equal(serialized.includes("网页正文"), false);
});

test("AI 采集首尾模式只给非 system 消息加 head/tail", () => {
  const long = "A".repeat(5000);
  const summary = summarizeArcPrompt(
    {
      feature: "ask-on-page",
      isDev: false,
      model: "claude-3-5-sonnet",
      prompt: [
        { role: "system", content: [{ type: "text", text: "系统限制" }] },
        { role: "user", content: [{ type: "text", text: long }] },
      ],
    },
    { includeUserContent: true },
  );
  assert.equal(summary.feature, "ask-on-page");
  assert.equal(summary.isDev, false);
  assert.equal(summary.model, "claude-3-5-sonnet");
  const [system, user] = summary.messages;
  assert.equal(system.head, undefined);
  assert.equal(user.head.length, 1500);
  assert.equal(user.tail.length, 1500);
  assert.equal(user.omitted, 5000 - 3000);
});

test("AI 采集摘要对非对象输入安全返回", () => {
  const summary = summarizeArcPrompt("not-an-object");
  assert.equal(summary.system, null);
  assert.deepEqual(summary.messages, []);
});
