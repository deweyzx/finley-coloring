"""
stamp_version.py - gives every app file reference a version stamp, e.g. "editor.js?v=202610181405".

Why: GitHub Pages lets browsers keep a copy of each file for about 10 minutes. Right after an
update, Safari could run the NEW page with some OLD code files (it already had them), and
things half-work. With a fresh stamp in every reference, the new page asks for files by
names the browser has never seen, so it always gets the matching new code. An old cached page
keeps asking for the old names, so it runs the complete old version until it refreshes.

Run it before every upload:   python tools/stamp_version.py
It updates index.html and the import lines in js/*.js. (Claude runs this when committing.)
"""

import datetime
import glob
import os
import re

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = datetime.datetime.now().strftime("%Y%m%d%H%M")

# import ... from "./editor.js"  /  from "../pages/pages.js"   (with or without an old ?v=)
IMPORTS = re.compile(r"""(\bfrom\s+["'])(\.{1,2}/[^"'?]+\.js)(\?v=[^"']*)?(["'])""")
# new Worker("js/fill-worker.js")
WORKERS = re.compile(r"""(new\s+Worker\(\s*["'])([^"'?]+\.js)(\?v=[^"']*)?(["'])""")
# <link href="css/styles.css">  /  <script src="js/app.js">
HTML_REFS = re.compile(r"""((?:href|src)=")((?:css|js)/[^"?]+\.(?:css|js))(\?v=[^"]*)?(")""")


def stamp(path, patterns):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    new = text
    for pattern in patterns:
        new = pattern.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={VERSION}{m.group(4)}", new)
    if new != text:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(new)
        return True
    return False


changed = []
if stamp(os.path.join(PROJECT, "index.html"), [HTML_REFS]):
    changed.append("index.html")
for path in sorted(glob.glob(os.path.join(PROJECT, "js", "*.js"))):
    if stamp(path, [IMPORTS, WORKERS]):
        changed.append(os.path.relpath(path, PROJECT).replace("\\", "/"))
print(f"Version {VERSION}: stamped {len(changed)} file(s): {', '.join(changed)}")
