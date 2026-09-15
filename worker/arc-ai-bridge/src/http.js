// 共享的 HTTP 响应工具。

export function jsonResponse(status, message) {
  return Response.json({ error: message }, { status });
}
