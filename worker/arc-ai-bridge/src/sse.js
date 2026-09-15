// 增量 SSE 解析器与序列化器。
//
// 设计约束（对应方案 6.3 节）：
//   - 真正的增量解析，不能按网络 chunk 直接 split("\n\n")。
//   - TextDecoder 使用 fatal，UTF-8 字符跨 chunk 时由 decoder 缓冲。
//   - 兼容 CRLF 与 LF。
//   - 多个 data: 行组成一个事件，以空行结束。
//   - 保留 event: / id: / retry: 与注释行。
//   - 注释行（心跳）立即透传。
//   - 单个事件超过上限时明确失败，不静默截断。

const encoder = new TextEncoder();

const DEFAULT_MAX_EVENT_BYTES = 1024 * 1024;

function newPending() {
  return {
    type: null,
    dataLines: [],
    id: null,
    retry: null,
    comments: [],
  };
}

export class SseError extends Error {}

/**
 * 增量 SSE 解析器。
 *
 * feed(chunk) 传入一个 Uint8Array（可为空），返回本次可完成的 SSE 块数组。
 * end() 在流结束时调用，flush decoder 并处理尾部残留。
 *
 * 返回的块结构：
 *   { type: string|null, data: string|null, id: string|null, retry: string|null, comments: string[] }
 * 其中 data 为多行 data: 以 "\n" 连接后的结果。
 */
export class SseParser {
  constructor(options = {}) {
    this.maxEventBytes = options.maxEventBytes ?? DEFAULT_MAX_EVENT_BYTES;
    if (!Number.isInteger(this.maxEventBytes) || this.maxEventBytes <= 0) {
      throw new SseError("maxEventBytes 必须是正整数");
    }
    this.decoder = new TextDecoder("utf-8", { fatal: true });
    this.buffer = "";
    this.pending = newPending();
    this.pendingBytes = 0;
    this.ended = false;
  }

  feed(chunk) {
    if (this.ended) throw new SseError("SSE 解析器已结束");
    const out = [];
    let text;
    try {
      text = this.decoder.decode(chunk ?? new Uint8Array(), { stream: true });
    } catch {
      throw new SseError("上游 SSE 不是合法 UTF-8");
    }
    this.buffer += text;
    this.drain(out);
    return out;
  }

  end() {
    if (this.ended) throw new SseError("SSE 解析器已结束");
    this.ended = true;
    const out = [];
    try {
      this.buffer += this.decoder.decode();
    } catch {
      throw new SseError("上游 SSE 在流结束时出现不完整 UTF-8 序列");
    }
    if (this.buffer.length > 0) {
      let line = this.buffer;
      if (line.endsWith("\r")) line = line.slice(0, -1);
      this.consumeLine(line, out);
      this.buffer = "";
    }
    this.flush(out);
    return out;
  }

  drain(out) {
    for (;;) {
      const index = this.buffer.indexOf("\n");
      if (index === -1) return;
      let line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      this.consumeLine(line, out);
    }
  }

  consumeLine(line, out) {
    // 空行：一个事件结束。
    if (line === "") {
      this.flush(out);
      return;
    }

    // 注释行：心跳，立即透传，不影响 pending 事件。
    if (line.startsWith(":")) {
      out.push({
        type: null,
        data: null,
        id: null,
        retry: null,
        comments: [line.slice(1)],
      });
      return;
    }

    const colon = line.indexOf(":");
    let field;
    let value;
    if (colon === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
    }

    switch (field) {
      case "event":
        this.pending.type = value;
        break;
      case "data":
        this.pending.dataLines.push(value);
        break;
      case "id":
        // 按 SSE 规范忽略包含 NUL 的 id。
        if (!value.includes("\u0000")) this.pending.id = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) this.pending.retry = value;
        break;
      default:
        // 未知字段按规范忽略。
        break;
    }

    this.pendingBytes += encoder.encode(line).length + 1;
    if (this.pendingBytes > this.maxEventBytes) {
      throw new SseError(`单个 SSE 事件超过上限 ${this.maxEventBytes} 字节`);
    }
  }

  flush(out) {
    const pending = this.pending;
    const empty =
      pending.type === null &&
      pending.dataLines.length === 0 &&
      pending.id === null &&
      pending.retry === null &&
      pending.comments.length === 0;
    if (empty) return;
    out.push({
      type: pending.type,
      data: pending.dataLines.length > 0 ? pending.dataLines.join("\n") : null,
      id: pending.id,
      retry: pending.retry,
      comments: pending.comments,
    });
    this.pending = newPending();
    this.pendingBytes = 0;
  }
}

/**
 * 将块重新序列化为 SSE 文本。
 * 多行 data 会逐行以 data: 前缀输出，保持 SSE 语义。
 */
export function serializeEvent(event) {
  let out = "";
  if (Array.isArray(event.comments)) {
    for (const comment of event.comments) out += `:${comment}\n`;
  }
  if (event.type !== null && event.type !== undefined) out += `event: ${event.type}\n`;
  if (event.id !== null && event.id !== undefined) out += `id: ${event.id}\n`;
  if (event.retry !== null && event.retry !== undefined) out += `retry: ${event.retry}\n`;
  if (event.data !== null && event.data !== undefined) {
    for (const line of String(event.data).split("\n")) out += `data: ${line}\n`;
  }
  out += "\n";
  return out;
}
