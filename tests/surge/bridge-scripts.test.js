// 通过 Node 模拟 Surge 脚本运行环境，验证两个请求脚本的行为（方案 9.2 节）。
//
// 运行：node --test tests/surge/*.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const surgeDir = resolve(here, "../../plugins/surge");

async function runSurgeScript(file, { url, headers = {}, argument = "" }) {
  const code = await readFile(resolve(surgeDir, file), "utf8");
  let result = null;
  let calls = 0;
  const $done = (value) => {
    result = value;
    calls += 1;
  };
  const run = new Function("$request", "$argument", "$done", code);
  run({ url, headers }, argument, $done);
  return { result, calls };
}

const LD_URL = "https://clientstream.launchdarkly.com/stream/eval?filter=abc";

test("LaunchDarkly 脚本：未配置 token 时明确失败且不访问上游", async () => {
  const { result, calls } = await runSurgeScript("arc-launchdarkly-bridge.js", {
    url: LD_URL,
    headers: { authorization: "sdk-key" },
    argument: "",
  });
  assert.equal(calls, 1);
  assert.equal(result.response.status, 403);
  assert.equal(result.url, undefined);
});

test("LaunchDarkly 脚本：改写 URL 指向 Worker 端点并带上令牌", async () => {
  const { result } = await runSurgeScript("arc-launchdarkly-bridge.js", {
    url: LD_URL,
    headers: { authorization: "sdk-key", "user-agent": "Arc" },
    argument: "BRIDGE_TOKEN=" + encodeURIComponent("token value"),
  });
  assert.ok(result.url.startsWith("https://arc-ai-bridge.upcore-a98.workers.dev/launchdarkly-stream?target="));
  assert.equal(decodeURIComponent(result.url.split("target=")[1]), LD_URL);
  assert.equal(result.headers["X-Arc-Bridge-Token"], "token value");
  assert.equal(result.headers.Accept, "text/event-stream");
});

test("LaunchDarkly 脚本：保留 Authorization、去掉 Cookie/Host/CF 头", async () => {
  const { result } = await runSurgeScript("arc-launchdarkly-bridge.js", {
    url: LD_URL,
    headers: {
      Authorization: "sdk-key",
      Cookie: "session=abc",
      Host: "clientstream.launchdarkly.com",
      "Content-Length": "0",
      "CF-Connecting-IP": "1.2.3.4",
      "X-Forwarded-For": "5.6.7.8",
    },
    argument: "BRIDGE_TOKEN=abc",
  });
  assert.equal(result.headers.Authorization, "sdk-key");
  assert.equal(result.headers.Cookie, undefined);
  assert.equal(result.headers.Host, undefined);
  assert.equal(result.headers["Content-Length"], undefined);
  assert.equal(result.headers["CF-Connecting-IP"], undefined);
  assert.equal(result.headers["X-Forwarded-For"], undefined);
});

test("Arc AI 脚本：仍然删除 Authorization 与 Cookie", async () => {
  const { result } = await runSurgeScript("arc-ai-bridge.js", {
    url: "https://aiproxy.diabrowser.engineering/api/dia-claude-stream",
    headers: { Authorization: "Bearer x", Cookie: "a=b", "Content-Type": "application/json" },
    argument: "BRIDGE_TOKEN=abc",
  });
  assert.equal(result.headers.authorization, undefined);
  assert.equal(result.headers.Authorization, undefined);
  assert.equal(result.headers.Cookie, undefined);
  assert.equal(result.headers["Content-Type"], "application/json");
  assert.ok(result.url.startsWith("https://arc-ai-bridge.upcore-a98.workers.dev/capture?target="));
});

test("Surge 脚本不写入持久化存储", async () => {
  for (const file of ["arc-ai-bridge.js", "arc-launchdarkly-bridge.js"]) {
    const code = await readFile(resolve(surgeDir, file), "utf8");
    const body = code
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    assert.equal(/\$persistentStore/.test(body), false, file);
    assert.equal(/console\.log/.test(body), false, file);
  }
});
