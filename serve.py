# serve.py - a tiny web server for testing the app on this PC.
# Run it with:  python serve.py   (or double-click start-server.bat)
# Then open http://localhost:8000 in Chrome. Press Ctrl+C (or close the window) to stop.
#
# Why not just double-click index.html? Browsers block some features (loading
# JavaScript modules, reading canvas pixels, offline mode) for files opened
# straight from disk. A local server makes it behave like the real website.

import argparse
import functools
import http.server
import os
import urllib.parse

# A different port gives design previews their own browser address. The working app's
# offline helper then cannot replace a preview with its cached home screen.
parser = argparse.ArgumentParser(description="Run the local coloring-book server.")
parser.add_argument("--port", type=int, default=8000, help="Local port (normally 8000).")
parser.add_argument("--design-preview", action="store_true", help="Open the layout mockup and keep this port free of the app's offline helper.")
options = parser.parse_args()
PORT = options.port
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
        ".woff2": "font/woff2",
    }

    def do_GET(self):
        # Even typing just localhost:8001 should open the preview, not install the app's
        # offline helper on this second address. Normal app testing is unchanged.
        if options.design_preview:
            requested = urllib.parse.urlsplit(self.path).path
            if requested in ("/", "/index.html"):
                self.send_response(302)
                self.send_header("Location", "/tools/design.tmp/compact-workspace.html")
                self.end_headers()
                return
            if requested == "/sw.js":
                self.send_error(404, "The design preview does not install an offline helper.")
                return
        super().do_GET()

    def end_headers(self):
        # Never cache while testing, so you always see your latest changes.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(Handler, directory=FOLDER)
with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
    print(f"Coloring app running at http://localhost:{PORT}  (Ctrl+C to stop)")
    server.serve_forever()
