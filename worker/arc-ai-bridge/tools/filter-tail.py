#!/usr/bin/env python3
"""把 wrangler tail 的输出过滤为「仅 LaunchDarkly 脱敏摘要」。

安全边界（方案 3.4 / 5.3 节）：
  - wrangler tail 的原始事件包含完整请求 URL、请求头（含 Authorization）与上下文。
  - 本过滤器只保留 Worker console.log 中以 [ld-capture] 开头的一行，
    其余内容一律丢弃，不写入任何捕获文件、不回显到终端。

用法：
  script -q /dev/null npx wrangler tail --format json 2>/dev/null | python3 filter-tail.py >> capture.log
"""

import json
import re
import sys

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|[\r\x07]")
DECODER = json.JSONDecoder()
PREFIX = "[ld-capture]"

buffer = ""


def message_text(entry):
    if not isinstance(entry, dict):
        return None
    msg = entry.get("message")
    if isinstance(msg, list):
        msg = " ".join(str(item) for item in msg)
    return msg if isinstance(msg, str) else None


def emit(obj):
    if not isinstance(obj, dict):
        return
    logs = obj.get("logs")
    if not isinstance(logs, list):
        return
    for entry in logs:
        message = message_text(entry)
        if message and message.startswith(PREFIX):
            print(message, flush=True)


def main():
    global buffer
    for raw_line in sys.stdin:
        buffer += ANSI.sub("", raw_line)
        while True:
            start = buffer.find("{")
            if start == -1:
                buffer = ""
                break
            if start > 0:
                buffer = buffer[start:]
            try:
                obj, end = DECODER.raw_decode(buffer)
            except ValueError:
                break
            emit(obj)
            buffer = buffer[end:]


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
