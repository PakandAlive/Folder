#!/usr/bin/env python3
"""诊断用 tail 过滤器。

只输出：请求方法、路径（去掉 query）、响应状态码，以及 [ld-capture] 摘要。
不输出 host 之外的完整 URL、不输出 query、不输出任何请求头取值。
仅用于链路诊断，不用于正式捕获。
"""

import json
import re
import sys

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|[\r\x07]")
DECODER = json.JSONDecoder()

buffer = ""


def short_path(url):
    try:
        from urllib.parse import urlsplit
        return urlsplit(url).path or "/"
    except Exception:
        return "<unparsable>"


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
    event = obj.get("event") or {}
    request = event.get("request") or {}
    response = event.get("response") or {}
    if request.get("url"):
        method = request.get("method", "?")
        status = response.get("status", "-")
        print(f"REQ {method} {short_path(request['url'])} -> {status} outcome={obj.get('outcome')}", flush=True)
    for entry in obj.get("logs") or []:
        msg = message_text(entry)
        if msg and (msg.startswith("[ld-capture]") or msg.startswith("[ld-debug]") or msg.startswith("[ai-capture]")):
            print(msg, flush=True)
    for exc in obj.get("exceptions") or []:
        name = exc.get("name") if isinstance(exc, dict) else None
        print(f"EXCEPTION {name}", flush=True)


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
