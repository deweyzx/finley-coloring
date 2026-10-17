# serve.py - a tiny web server for testing the app on this PC.
# Run it with:  python serve.py   (or double-click start-server.bat)
# Then open http://localhost:8000 in Chrome. Press Ctrl+C (or close the window) to stop.
#
# Why not just double-click index.html? Browsers block some features (loading
# JavaScript modules, reading canvas pixels, offline mode) for files opened
# straight from disk. A local server makes it behave like the real website.

import functools
import http.server
import os

PORT = 8000
FOLDER = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    # Windows sometimes reports the wrong file types, which breaks JavaScript modules.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        # Never cache while testing, so you always see your latest changes.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(Handler, directory=FOLDER)
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
    print(f"Coloring app running at http://localhost:{PORT}  (Ctrl+C to stop)")
    server.serve_forever()
