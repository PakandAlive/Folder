import { test } from "node:test";
import assert from "node:assert/strict";

import { SseError, SseParser, serializeEvent } from "../src/sse.js";

const encoder = new TextEncoder();

function feedAll(text, { sliceSize = 1, parser } = {}) {
  const instance = parser ?? new SseParser();
  const bytes = encoder.encode(text);
  const out = [];
  for (let offset = 0; offset < bytes.length; offset += sliceSize) {
    out.push(...instance.feed(bytes.slice(offset, offset + sliceSize)));
  }
  out.push(...instance.end());
  return out;
}

test("解析单个带事件名的事件", () => {
  const events = feedAll("event: put\ndata: {\"a\":1}\n\n");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "put");
  assert.equal(events[0].data, '{"a":1}');
});

test("兼容 CRLF", () => {
  const events = feedAll("event: put\r\ndata: {\"a\":1}\r\n\r\n");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "put");
  assert.equal(events[0].data, '{"a":1}');
});

test("多行 data 合并为一个事件", () => {
  const events = feedAll("event: patch\ndata: line1\ndata: line2\n\n");
  assert.equal(events.length, 1);
  assert.equal(events[0].data, "line1\nline2");
});

test("注释行立即透传且不打断待完成事件", () => {
  const parser = new SseParser();
  const bytes = encoder.encode(": keepalive\nevent: put\ndata: {}\n\n");
  const out = [...parser.feed(bytes), ...parser.end()];
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].comments, [" keepalive"]);
  assert.equal(out[0].data, null);
  assert.equal(out[1].type, "put");
  assert.equal(out[1].data, "{}");
});

test("保留 id 与 retry 字段", () => {
  const events = feedAll("id: 42\nretry: 3000\nevent: put\ndata: {}\n\n");
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "42");
  assert.equal(events[0].retry, "3000");
});

test("UTF-8 多字节字符跨 chunk 不损坏", () => {
  const events = feedAll('event: put\ndata: {"text":"中文内容"}\n\n', { sliceSize: 1 });
  assert.equal(events.length, 1);
  assert.equal(events[0].data, '{"text":"中文内容"}');
});

test("流结束时的不完整 UTF-8 序列明确失败", () => {
  const parser = new SseParser();
  const bytes = encoder.encode("event: put\ndata: 中");
  parser.feed(bytes.slice(0, bytes.length - 1));
  assert.throws(() => parser.end(), SseError);
});

test("单个事件超过上限时明确失败", () => {
  const parser = new SseParser({ maxEventBytes: 16 });
  assert.throws(() => parser.feed(encoder.encode("data: 0123456789012345678901234\n")), SseError);
});

test("serializeEvent 往返保持语义", () => {
  const text = "event: put\nid: 7\ndata: {\"a\":1}\n\n";
  const events = feedAll(text);
  assert.equal(serializeEvent(events[0]), text);
});

test("serializeEvent 还原多行 data", () => {
  const events = feedAll("data: a\ndata: b\n\n");
  assert.equal(serializeEvent(events[0]), "data: a\ndata: b\n\n");
});
