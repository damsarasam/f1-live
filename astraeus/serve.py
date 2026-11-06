"""Serve this static app with page routes falling back to index.html.

Run: python3 serve.py [port]
"""
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        # Page addresses (no file extension) are client routes: all get the one shell
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if not Path(path).suffix and not (ROOT / path.lstrip("/")).is_file():
            self.path = "/index.html"
        return super().send_head()

    def end_headers(self):
        # Revalidate on every load so edits show up without a hard refresh
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # A page pulls in dozens of modules at once; the default queue of 5 drops some of them
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    Server(("127.0.0.1", port), Handler).serve_forever()
