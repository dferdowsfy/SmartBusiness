"""Minimal single-request local HTTP server used to capture OAuth redirects.

TikTok's and Instagram's OAuth dialogs redirect the browser back to a
localhost URL with `code` (and `state`) in the query string. This spins up
a plain-stdlib HTTP server, blocks until that one redirect arrives, and
returns its query parameters.
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

_RESPONSE_BODY = (
    b"<html><body><h3>Done - you can close this tab and return to the "
    b"terminal.</h3></body></html>"
)


class _CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - required BaseHTTPRequestHandler name
        query = parse_qs(urlparse(self.path).query)
        self.server.captured_query = {key: values[0] for key, values in query.items()}  # type: ignore[attr-defined]
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(_RESPONSE_BODY)

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib signature
        return


def capture_redirect_query(port: int) -> dict[str, str]:
    """Block until one browser redirect hits http://localhost:{port}/..., then
    return its query parameters (e.g. {"code": "...", "state": "..."})."""
    server = HTTPServer(("localhost", port), _CallbackHandler)
    server.captured_query = {}  # type: ignore[attr-defined]
    try:
        server.handle_request()
    finally:
        server.server_close()
    return server.captured_query  # type: ignore[attr-defined]
