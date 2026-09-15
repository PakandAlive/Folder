import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LaunchDarklyError,
  createLaunchDarklyStream,
  handleLaunchDarklyStream,
  rewriteEvent,
  summarizeEvent,
  TARGET_FLAGS,
} from "../src/launchdarkly.js";

const encoder = new TextEncoder();

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

function bodyFromText(text, sliceSize = 7) {
  const bytes = encoder.encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + sliceSize));
      offset += sliceSize;
    },
  });
}

function block(type, data) {
  return { type, data: typeof data === "string" ? data : JSON.stringify(data), id: null, retry: null, comments: [] };
}

const OTHER_FLAG = {
  value: "中文默认值",
  variation: 2,
  version: 5,
  flagVersion: 5,
  trackEvents: false,
  reason: { kind: "FALLTHROUGH" },
};

test("初始化 put 事件只修改两个目标开关", () => {
  const payload = {
    data: {
      "ask-in-page-enabled": { value: false, variation: 1, version: 947, flagVersion: 10 },
      "arc-ai-search-enabled": { value: false, variation: 1, version: 12, flagVersion: 3 },
      "some-other-flag": { ...OTHER_FLAG },
    },
  };
  const out = rewriteEvent(block("put", payload));
  const parsed = JSON.parse(out.data);
  assert.equal(parsed.data["ask-in-page-enabled"].value, true);
  assert.equal(parsed.data["ask-in-page-enabled"].variation, 0);
  assert.equal(parsed.data["arc-ai-search-enabled"].value, true);
  assert.equal(parsed.data["arc-ai-search-enabled"].variation, 0);
  // 其他字段保留
  assert.equal(parsed.data["ask-in-page-enabled"].version, 947);
  assert.equal(parsed.data["ask-in-page-enabled"].flagVersion, 10);
  // 其他开关深度相等
  assert.deepEqual(parsed.data["some-other-flag"], OTHER_FLAG);
});

test("初始化事件缺少目标开关时明确失败", () => {
  const payload = { data: { "some-other-flag": { ...OTHER_FLAG } } };
  assert.throws(() => rewriteEvent(block("put", payload)), LaunchDarklyError);
});

test("patch 事件指向目标开关时被修改", () => {
  const payload = { path: "/ask-in-page-enabled", data: { value: false, variation: 1, version: 948 } };
  const out = rewriteEvent(block("patch", payload));
  const parsed = JSON.parse(out.data);
  assert.equal(parsed.data.value, true);
  assert.equal(parsed.data.variation, 0);
  assert.equal(parsed.data.version, 948);
});

test("patch 事件指向其他开关时语义不变", () => {
  const payload = { path: "/some-other-flag", data: { value: "中文默认值", variation: 2, version: 6 } };
  const out = rewriteEvent(block("patch", payload));
  assert.equal(out.data, JSON.stringify(payload));
});

test("delete 事件指向目标开关时原样透传（不伪造、不终止流）", () => {
  const payload = { path: "/ask-in-page-enabled", version: 2000 };
  const event = block("delete", payload);
  assert.equal(rewriteEvent(event), event);
});

test("patch 结构不可识别时原样透传", () => {
  const payload = { path: "/ask-in-page-enabled", data: { value: "false" } };
  const event = block("patch", payload);
  assert.equal(rewriteEvent(event), event);
});

test("未知事件类型原样透传", () => {
  const event = block("heartbeat-meta", { anything: true });
  assert.equal(rewriteEvent(event), event);
});

test("未命名事件不参与改写", () => {
  const event = { type: null, data: '{"path":"/ask-in-page-enabled"}', id: null, retry: null, comments: [] };
  assert.equal(rewriteEvent(event), event);
});

test("流式转换跨 chunk 且中文原样保留", async () => {
  const text =
    ": keepalive\n\n" +
    "event: put\ndata: " +
    JSON.stringify({
      data: {
        "ask-in-page-enabled": { value: false, variation: 1, version: 1 },
        "arc-ai-search-enabled": { value: false, variation: 1, version: 1 },
        "some-other-flag": { ...OTHER_FLAG },
      },
    }) +
    "\n\n" +
    "event: patch\ndata: " +
    JSON.stringify({ path: "/some-other-flag", data: { value: "中文默认值", version: 2 } }) +
    "\n\n";
  const stream = createLaunchDarklyStream(bodyFromText(text, 3));
  const output = await readAll(stream);
  assert.ok(output.includes(": keepalive"));
  assert.ok(output.includes('"ask-in-page-enabled":{"value":true,"variation":0'));
  assert.ok(output.includes("中文默认值"));
  const patchLine = output.split("\n").find((line) => line.startsWith("data: ") && line.includes("some-other-flag"));
  assert.ok(patchLine.includes('"value":"中文默认值"'));
});

test("上游 put 里目标开关 value 非布尔时流以错误终止", async () => {
  const text =
    "event: put\ndata: " +
    JSON.stringify({
      "ask-in-page-enabled": { value: "false", variation: 1, version: 947 },
      "arc-ai-search-enabled": { value: false, variation: 1, version: 947 },
    }) +
    "\n\n";
  const stream = createLaunchDarklyStream(bodyFromText(text, 10));
  await assert.rejects(() => readAll(stream), /不是布尔值/);
});

test("采集摘要只包含目标字段", () => {
  const summary = summarizeEvent(
    block("put", {
      data: {
        "ask-in-page-enabled": { value: false, variation: 1, version: 947, flagVersion: 10, secret: "x" },
      },
    }),
  );
  assert.equal(summary.event, "put");
  assert.deepEqual(summary.targets["ask-in-page-enabled"], {
    value: false,
    variation: 1,
    version: 947,
    flagVersion: 10,
  });
  assert.equal(JSON.stringify(summary).includes("secret"), false);
});

test("处理器拒绝错误令牌", async () => {
  const response = await handleLaunchDarklyStream(
    { method: "GET", headers: new Headers() },
    { BRIDGE_TOKEN: "s3cret" },
    new URL("https://worker.example/launchdarkly-stream?target=" + encodeURIComponent("https://clientstream.launchdarkly.com/x")),
  );
  assert.equal(response.status, 401);
});

test("处理器拒绝非白名单主机", async () => {
  const response = await handleLaunchDarklyStream(
    { method: "GET", headers: new Headers({ "x-arc-bridge-token": "s3cret" }) },
    { BRIDGE_TOKEN: "s3cret" },
    new URL("https://worker.example/launchdarkly-stream?target=" + encodeURIComponent("https://evil.example/x")),
  );
  assert.equal(response.status, 422);
});

test("处理器拒绝非 HTTPS 目标", async () => {
  const response = await handleLaunchDarklyStream(
    { method: "GET", headers: new Headers({ "x-arc-bridge-token": "s3cret" }) },
    { BRIDGE_TOKEN: "s3cret" },
    new URL("https://worker.example/launchdarkly-stream?target=" + encodeURIComponent("http://clientstream.launchdarkly.com/x")),
  );
  assert.equal(response.status, 422);
});

test("处理器转发成功路径并改写，不转发 cookie/host", async () => {
  const original = globalThis.fetch;
  const seen = { url: null, headers: null };
  const upstreamText =
    "event: put\ndata: " +
    JSON.stringify({
      data: {
        "ask-in-page-enabled": { value: false, variation: 1, version: 1 },
        "arc-ai-search-enabled": { value: false, variation: 1, version: 1 },
      },
    }) +
    "\n\n";
  globalThis.fetch = async (url, init) => {
    seen.url = url;
    seen.headers = init.headers;
    return new Response(bodyFromText(upstreamText, 5), {
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    });
  };
  try {
    const response = await handleLaunchDarklyStream(
      {
        method: "GET",
        headers: new Headers({
          "x-arc-bridge-token": "s3cret",
          authorization: "sdk-key-here",
          cookie: "session=abc",
          host: "clientstream.launchdarkly.com",
        }),
      },
      { BRIDGE_TOKEN: "s3cret", LD_REWRITE: "1" },
      new URL(
        "https://worker.example/launchdarkly-stream?target=" +
          encodeURIComponent("https://clientstream.launchdarkly.com/stream/eval"),
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(response.headers.get("x-arc-ld-mode"), "rewrite");
    assert.equal(seen.url, "https://clientstream.launchdarkly.com/stream/eval");
    assert.equal(seen.headers.get("authorization"), "sdk-key-here");
    assert.equal(seen.headers.get("cookie"), null);
    assert.equal(seen.headers.get("host"), null);
    const output = await readAll(response.body);
    assert.ok(output.includes('"ask-in-page-enabled":{"value":true,"variation":0'));
  } finally {
    globalThis.fetch = original;
  }
});

test("处理器拒绝非 SSE 上游", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("nope", { status: 200, headers: { "content-type": "application/json" } });
  try {
    const response = await handleLaunchDarklyStream(
      { method: "GET", headers: new Headers({ "x-arc-bridge-token": "s3cret" }) },
      { BRIDGE_TOKEN: "s3cret" },
      new URL(
        "https://worker.example/launchdarkly-stream?target=" +
          encodeURIComponent("https://clientstream.launchdarkly.com/stream"),
      ),
    );
    assert.equal(response.status, 502);
  } finally {
    globalThis.fetch = original;
  }
});

test("未启用 LD_REWRITE 时端点只透传不改写", async () => {
  const original = globalThis.fetch;
  const upstreamText =
    "event: put\ndata: " +
    JSON.stringify({
      data: {
        "ask-in-page-enabled": { value: false, variation: 1, version: 1 },
        "arc-ai-search-enabled": { value: false, variation: 1, version: 1 },
      },
    }) +
    "\n\n";
  globalThis.fetch = async () =>
    new Response(bodyFromText(upstreamText, 4), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  try {
    const response = await handleLaunchDarklyStream(
      { method: "GET", headers: new Headers({ "x-arc-bridge-token": "s3cret" }) },
      { BRIDGE_TOKEN: "s3cret" },
      new URL(
        "https://worker.example/launchdarkly-stream?target=" +
          encodeURIComponent("https://clientstream.launchdarkly.com/stream"),
      ),
    );
    assert.equal(response.headers.get("x-arc-ld-mode"), "passthrough");
    const output = await readAll(response.body);
    assert.ok(output.includes('"ask-in-page-enabled":{"value":false,"variation":1'));
  } finally {
    globalThis.fetch = original;
  }
});

test("目标开关集合固定为两个", () => {
  assert.deepEqual([...TARGET_FLAGS].sort(), ["arc-ai-search-enabled", "ask-in-page-enabled"]);
});
