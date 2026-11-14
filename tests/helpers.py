"""Tiny ASGI client so API tests need no extra dependency (no httpx)."""
import asyncio
import json


async def _call(app, method, path, body=None):
    raw = json.dumps(body).encode() if body is not None else b""
    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method, "scheme": "http", "path": path,
             "raw_path": path.encode(), "query_string": b"", "client": ("127.0.0.1", 1), "server": ("test", 80),
             "headers": [(b"host", b"test"), (b"content-type", b"application/json"), (b"content-length", str(len(raw)).encode())]}
    sent = {"done": False}

    async def receive():
        if not sent["done"]:
            sent["done"] = True
            return {"type": "http.request", "body": raw, "more_body": False}
        return {"type": "http.disconnect"}

    out = {"status": None, "body": b""}

    async def send(message):
        if message["type"] == "http.response.start":
            out["status"] = message["status"]
        elif message["type"] == "http.response.body":
            out["body"] += message.get("body", b"")

    await app(scope, receive, send)
    return out["status"], json.loads(out["body"] or b"null")


def call(app, method, path, body=None):
    return asyncio.run(_call(app, method, path, body))
