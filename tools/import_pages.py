"""
import_pages.py - turns raw coloring page images into clean pages for the app.

HOW TO USE (see README.md for more):
  1. Put images in   import/<category>/<sub-category>/   e.g. import/Flowers/Roses/
  2. Double-click import-pages.bat   (or run:  python tools/import_pages.py)

For each image it:
  - makes the paper pure white and the lines solid black (no grey haze, no specks),
    with a thin smooth edge on the lines so curves aren't jagged (see EDGE_SOFTNESS)
  - trims empty margins and resizes it to the app's page size
  - thickens lines that are too thin and seals tiny diagonal leaks
  - saves it as a PNG in pages/<category>/<sub-category>/ with a clean name
  - adds it to pages/pages.js (creating the category/sub-category if needed)

Your original images are only READ, never changed, moved or deleted.
"""

import hashlib
import json
import os
import re
import sys
import unicodedata

try:
    import numpy as np
    from PIL import Image, ImageFilter, ImageOps
except ImportError:
    print("This tool needs Pillow and NumPy. Install them with:")
    print("    python -m pip install --user pillow numpy")
    sys.exit(1)

# ---------------------------------------------------------------- SETTINGS --
# Page size in pixels (portrait). Wide pictures get the sideways version.
PAGE_LONG = 2732
PAGE_SHORT = 2048
# Empty white border kept around the drawing, in pixels.
MARGIN = 64
# Black blobs smaller than this many pixels (on the final page) are removed as specks.
# Only blobs that touch nothing else count; dots on a line are part of the line.
# 150 is about a 14-pixel-wide dot. Raise it if specks survive, lower it if real dots
# (like tiny eyes or decorative dots) disappear.
SPECK_AREA = 150
# Lines are "too thin" when less than this share of their pixels is more than
# 1 pixel away from the edge of the line. Thin pages get thickened by 1 pixel per side.
THIN_LINE_RATIO = 0.25
MAX_THICKEN_STEPS = 2
# How soft the edges of the lines are, in pixels. Lines are always solid black through
# the middle; this only smooths their outer edge so curves don't look jagged when zoomed in.
#   0   = hard pixel edges (pure black and white, stair-steps visible when zoomed)
#   0.7 = a thin smooth edge (recommended)
#   1.2 = softer edges
EDGE_SOFTNESS = 0.7
# Skip images that are mostly dark (probably a photo or a colored picture, not line art).
MAX_INK_SHARE = 0.45
# How similar two pages must look to count as duplicates (0 = identical; bigger = looser).
DUPLICATE_DISTANCE = 12
# ----------------------------------------------------------------------------

IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".webp"}

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMPORT_DIR = os.path.join(PROJECT, "import")
PAGES_DIR = os.path.join(PROJECT, "pages")
PAGES_JS = os.path.join(PAGES_DIR, "pages.js")
LOG_FILE = os.path.join(PROJECT, "tools", "import-log.json")


class Skip(Exception):
    """An image we can't (or shouldn't) import. The message says why."""


# ============================================================ IMAGE CLEANUP ==

def load_gray(path):
    """Opens an image as greyscale, with any see-through parts turned white."""
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)  # phone photos: apply their rotation
            im.load()
    except Exception:
        raise Skip("couldn't be opened (damaged, or not really an image)")
    if im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        white = Image.new("RGBA", im.size, (255, 255, 255, 255))
        white.alpha_composite(im)
        im = white
    return im.convert("L")


def flatten_paper(gray):
    """Estimates the paper's brightness everywhere (ignoring the lines) and divides
    it out, so off-white, yellowed or unevenly lit paper becomes pure white."""
    w, h = gray.size
    small = gray.resize((max(1, w // 8), max(1, h // 8)), Image.BILINEAR)
    small = small.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(4))
    paper = np.asarray(small.resize((w, h), Image.BILINEAR), np.float32)
    # Where the "paper" looks dark, it's really a big black area, not paper: don't brighten it.
    paper = np.maximum(paper, 150)
    pixels = np.asarray(gray, np.float32)
    return np.clip(pixels / paper * 255, 0, 255).astype(np.uint8)


def ink_threshold(pixels):
    """Picks the brightness that best separates lines from paper (Otsu's method)."""
    hist = np.bincount(pixels.ravel(), minlength=256).astype(np.float64)
    levels = np.arange(256)
    w_dark = np.cumsum(hist)
    w_light = w_dark[-1] - w_dark
    sum_dark = np.cumsum(levels * hist)
    mean_dark = sum_dark / np.maximum(w_dark, 1)
    mean_light = (sum_dark[-1] - sum_dark) / np.maximum(w_light, 1)
    spread = w_dark * w_light * (mean_dark - mean_light) ** 2
    return int(min(max(np.argmax(spread), 100), 210))


def remove_specks(ink, max_area):
    """Removes connected black blobs smaller than max_area pixels.

    It looks at each row as a list of black "runs", joins runs that touch the
    runs in the row above (corners count), and adds up each group's size."""
    if max_area < 1:
        return ink
    h, w = ink.shape
    padded = np.zeros((h, w + 2), np.int8)
    padded[:, 1:-1] = ink
    edges = np.diff(padded, axis=1)
    run_row, run_start = np.nonzero(edges == 1)
    _, run_end = np.nonzero(edges == -1)
    n = len(run_row)
    if n == 0:
        return ink

    first_run_of_row = np.searchsorted(run_row, np.arange(h + 1)).tolist()
    starts = run_start.tolist()
    ends = run_end.tolist()
    parent = list(range(n))

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for r in range(1, h):
        i, i_stop = first_run_of_row[r - 1], first_run_of_row[r]
        j, j_stop = first_run_of_row[r], first_run_of_row[r + 1]
        while i < i_stop and j < j_stop:
            if starts[i] <= ends[j] and starts[j] <= ends[i]:  # touching, corners included
                a, b = root(i), root(j)
                if a != b:
                    parent[a] = b
            if ends[i] < ends[j]:
                i += 1
            else:
                j += 1

    roots = np.array([root(k) for k in range(n)])
    area = np.bincount(roots, weights=run_end - run_start, minlength=n)
    cleaned = ink.copy()
    for k in np.nonzero(area[roots] < max_area)[0]:
        cleaned[run_row[k], starts[k]:ends[k]] = False
    return cleaned


def seal_diagonal_leaks(ink):
    """Where two black pixels touch only at their corners, a fill could squeeze
    between them. Blacken one more pixel at each such spot to close it."""
    a = ink[:-1, :-1]
    b = ink[:-1, 1:]
    c = ink[1:, :-1]
    d = ink[1:, 1:]
    sealed = ink.copy()
    sealed[:-1, 1:] |= a & d & ~b & ~c  # "\" pattern: fill the top-right pixel
    sealed[:-1, :-1] |= b & c & ~a & ~d  # "/" pattern: fill the top-left pixel
    return sealed


def thicken_thin_lines(ink):
    """If most lines are only 1-2 pixels wide, grows every line by 1 pixel per side."""
    steps = 0
    for _ in range(MAX_THICKEN_STEPS):
        black = int(ink.sum())
        if black == 0:
            break
        img = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8))
        core = np.asarray(img.filter(ImageFilter.MaxFilter(3))) == 0  # black left after shaving 1px off
        if core.sum() / black >= THIN_LINE_RATIO:
            break
        ink = np.asarray(img.filter(ImageFilter.MinFilter(3))) == 0  # grow lines by 1px
        steps += 1
    return ink, steps


def smooth_edges(ink):
    """Turns the black-and-white page into the final greyscale page: lines stay solid
    black through the middle, with a thin smooth edge so curves don't look jagged.

    Every line pixel stays darker than middle grey, and every paper pixel stays lighter,
    so tap-to-fill (which treats "darker than middle grey" as a line) sees exactly the
    same lines as the pure black-and-white version."""
    if EDGE_SOFTNESS <= 0:
        return Image.fromarray(np.where(ink, 0, 255).astype(np.uint8))
    hard = Image.fromarray(ink.astype(np.uint8) * 255)
    blurred = np.asarray(hard.filter(ImageFilter.GaussianBlur(EDGE_SOFTNESS)), np.float32) / 255
    darkness = np.clip((blurred - 0.5) * 2 + 0.5, 0, 1)  # steepen it: the soft part stays a thin band
    darkness = np.where(ink, np.maximum(darkness, 0.53), np.minimum(darkness, 0.47))
    return Image.fromarray(np.round(255 - darkness * 255).astype(np.uint8))


def clean_page(path):
    """Runs the whole cleanup. Returns (black & white page image, notes list)."""
    notes = []
    gray = load_gray(path)
    w, h = gray.size
    if min(w, h) < 300:
        raise Skip(f"too small ({w}x{h} pixels); needs at least 300 on each side")
    if max(w, h) < 1200:
        notes.append(f"low resolution ({w}x{h}), may look soft")
    # Line art is mostly paper, so it's bright on average. Check before the paper is evened out,
    # which would brighten a dark photo too.
    original_dark = (np.asarray(gray) < 128).mean()
    if original_dark > MAX_INK_SHARE:
        raise Skip(f"mostly dark ({original_dark:.0%} dark), doesn't look like line art")

    pixels = flatten_paper(gray)
    cutoff = ink_threshold(pixels)

    # Find where the drawing is (ignoring specks) so the empty margins can be trimmed.
    preview_scale = min(1.0, 1024 / max(w, h))
    preview = Image.fromarray(pixels).resize(
        (max(1, round(w * preview_scale)), max(1, round(h * preview_scale))), Image.BILINEAR)
    preview_ink = np.asarray(preview) < cutoff
    share = preview_ink.mean()
    if share > MAX_INK_SHARE:
        raise Skip(f"mostly dark ({share:.0%} black), doesn't look like line art")
    preview_ink = remove_specks(preview_ink, SPECK_AREA * (1024 / PAGE_LONG) ** 2 + 1)
    rows = np.nonzero(preview_ink.any(axis=1))[0]
    cols = np.nonzero(preview_ink.any(axis=0))[0]
    if len(rows) == 0 or preview_ink.sum() < 50:
        raise Skip("looks blank (no lines found)")
    pad = 2
    top = max(0, int((rows[0] - pad) / preview_scale))
    bottom = min(h, int((rows[-1] + 1 + pad) / preview_scale))
    left = max(0, int((cols[0] - pad) / preview_scale))
    right = min(w, int((cols[-1] + 1 + pad) / preview_scale))
    drawing = Image.fromarray(pixels[top:bottom, left:right])

    # Resize onto a page with the same shape as the drawing (upright or sideways).
    dw, dh = drawing.size
    page_w, page_h = (PAGE_LONG, PAGE_SHORT) if dw > dh else (PAGE_SHORT, PAGE_LONG)
    scale = min((page_w - 2 * MARGIN) / dw, (page_h - 2 * MARGIN) / dh)
    new_w, new_h = max(1, round(dw * scale)), max(1, round(dh * scale))
    page = Image.new("L", (page_w, page_h), 255)
    page.paste(drawing.resize((new_w, new_h), Image.LANCZOS), ((page_w - new_w) // 2, (page_h - new_h) // 2))

    # Pure black and white, then the cleanup steps.
    ink = np.asarray(page) < cutoff
    ink = remove_specks(ink, SPECK_AREA)
    ink, steps = thicken_thin_lines(ink)
    if steps:
        notes.append(f"thin lines thickened by {steps * 2}px")
    ink = seal_diagonal_leaks(ink)

    return smooth_edges(ink), notes


def fingerprint(img):
    """A small "what it looks like" code, used to spot the same picture saved twice."""
    small = np.asarray(img.convert("L").resize((17, 16), Image.BOX), np.int16)
    bits = (small[:, 1:] > small[:, :-1]).ravel()
    return "".join("1" if b else "0" for b in bits)


def looks_same(a, b):
    return len(a) == len(b) and sum(x != y for x, y in zip(a, b)) <= DUPLICATE_DISTANCE


def file_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


# ============================================================ NAMES ==========

FILLER_WORDS = {
    "a", "an", "the", "of", "with", "and", "in", "on", "for", "to", "page", "pages", "coloring",
    "colouring", "book", "adult", "adults", "detailed", "line", "lines", "lineart", "art", "black",
    "white", "printable", "free", "final", "copy", "edited", "version", "hd", "high", "res",
    "quality", "outline", "drawing", "sheet", "style",
}
JUNK_FIRST_WORDS = {
    "chatgpt", "dall", "dalle", "midjourney", "mj", "firefly", "gemini", "leonardo", "image", "img",
    "screenshot", "download", "untitled", "file", "photo", "pxl", "dsc", "scan", "generated",
}


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def nice_page_name(original_stem, sub_folder, taken):
    """Makes a clean, unique name from the original file name, e.g.
    "A detailed coloring page of a red ROSE (2).jpg" -> "red-rose-2".
    Machine names like "ChatGPT Image 3 Oct 2026, 10_14_22.png" become "roses-01"."""
    # Windows hides file extensions, so names like "daffodil.png.png" are common: drop the extra one.
    original_stem = re.sub(r"(\.(png|jpe?g|webp))+$", "", original_stem, flags=re.I)
    words = slugify(original_stem).split("-")
    if words and words[0] in JUNK_FIRST_WORDS:
        words = []
    words = [w for w in words
             if w and w not in FILLER_WORDS
             and not re.fullmatch(r"\d{4,}|(?=[a-f0-9]*\d)[a-f0-9]{6,}", w)]  # dates, codes
    letters = sum(c.isalpha() for c in "".join(words))
    if letters >= 3:
        base = "-".join(words[:5])
        name, n = base, 2
        while name in taken:
            name, n = f"{base}-{n}", n + 1
    else:
        n = 1
        while f"{sub_folder}-{n:02d}" in taken:
            n += 1
        name = f"{sub_folder}-{n:02d}"
    taken.add(name)
    return name


# Words in import folder names that don't belong in the name she sees.
FOLDER_FILLER = re.compile(
    r"\b(colou?ring\s+(pages?|sheets?|books?|pictures?)|colou?ring|line\s*art|for\s+adults?"
    r"|free\s+printables?|printables?|pages?|sheets?|png|jpe?g|webp)\b", re.I)
SMALL_WORDS = {"a", "an", "and", "the", "of", "in", "on", "or", "to", "with", "for", "at", "by"}


def display_name(folder_name):
    """Turns an import folder name into the name she sees, e.g.
    "tiger-lily-coloring-page" -> "Tiger Lily", "Mandalas for Adults" -> "Mandalas",
    "Golden Retrievers" -> "Golden Retrievers". Singular/plural is kept as you typed it."""
    spaced = re.sub(r"[-_.]+", " ", folder_name)
    words = FOLDER_FILLER.sub(" ", spaced).split()
    if not words:  # the name was only filler (e.g. "Coloring Pages"): keep it as typed
        words = spaced.split()
    out = []
    for n, word in enumerate(words):
        if any(c.isupper() for c in word):
            out.append(word)  # keep the capitals you typed, like "USA"
        elif n > 0 and word in SMALL_WORDS:
            out.append(word)
        else:
            out.append(word[0].upper() + word[1:])
    return " ".join(out)


def group_key(name):
    """A loose version of a category name for matching, so "Daffodil", "daffodils" and
    "daffodil-coloring-page" all count as the same sub-category."""
    def singular(word):
        if len(word) > 4 and word.endswith("ies"):
            return word[:-3] + "y"
        if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
            return word[:-1]
        return word
    return "-".join(singular(w) for w in slugify(display_name(name)).split("-"))


def find_group(groups, folder_name):
    key = group_key(folder_name)
    return next((g for g in groups if group_key(g.get("name") or g["folder"]) == key
                 or group_key(g["folder"]) == key), None)


# ============================================================ pages.js =======
# pages.js is JavaScript, so we read it with a tiny reader that understands the
# parts we use: [lists], {objects}, "strings", numbers, comments, trailing commas.

class PagesJsError(Exception):
    pass


class JsReader:
    SPACE = re.compile(r"(?:\s+|//[^\n]*|/\*.*?\*/)+", re.S)
    KEY = re.compile(r"[A-Za-z_$][\w$]*")
    NUMBER = re.compile(r"-?\d+(?:\.\d+)?")

    def __init__(self, text, pos):
        self.s, self.i = text, pos

    def fail(self, what):
        line = self.s.count("\n", 0, self.i) + 1
        raise PagesJsError(f"{what} on line {line} of pages.js")

    def skip_space(self):
        m = self.SPACE.match(self.s, self.i)
        if m:
            self.i = m.end()

    def peek(self):
        self.skip_space()
        return self.s[self.i] if self.i < len(self.s) else ""

    def value(self):
        c = self.peek()
        if c == "[":
            return self.list_()
        if c == "{":
            return self.object_()
        if c in "\"'`":
            return self.string()
        for word, val in (("true", True), ("false", False), ("null", None)):
            if self.s.startswith(word, self.i):
                self.i += len(word)
                return val
        m = self.NUMBER.match(self.s, self.i)
        if m:
            self.i = m.end()
            return float(m.group()) if "." in m.group() else int(m.group())
        self.fail(f"Unexpected '{c}'")

    def string(self):
        quote = self.s[self.i]
        self.i += 1
        out = []
        escapes = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\", "'": "'", '"': '"', "`": "`"}
        while self.i < len(self.s):
            c = self.s[self.i]
            if c == "\\":
                nxt = self.s[self.i + 1]
                if nxt == "u":
                    out.append(chr(int(self.s[self.i + 2:self.i + 6], 16)))
                    self.i += 6
                    continue
                out.append(escapes.get(nxt, nxt))
                self.i += 2
                continue
            if c == quote:
                self.i += 1
                return "".join(out)
            if c == "\n" and quote != "`":
                break
            out.append(c)
            self.i += 1
        self.fail("A text value is missing its closing quote")

    def list_(self):
        self.i += 1
        items = []
        while True:
            if self.peek() == "]":
                self.i += 1
                return items
            items.append(self.value())
            c = self.peek()
            if c == ",":
                self.i += 1
            elif c != "]":
                self.fail("Expected a comma or ] (a missing comma?)")

    def object_(self):
        self.i += 1
        obj = {}
        while True:
            c = self.peek()
            if c == "}":
                self.i += 1
                return obj
            if c in "\"'":
                key = self.string()
            else:
                m = self.KEY.match(self.s, self.i)
                if not m:
                    self.fail("Expected a name like  name:  or  folder:")
                key = m.group()
                self.i = m.end()
            if self.peek() != ":":
                self.fail(f"Expected ':' after '{key}'")
            self.i += 1
            obj[key] = self.value()
            c = self.peek()
            if c == ",":
                self.i += 1
            elif c != "}":
                self.fail("Expected a comma or } (a missing comma?)")


def read_pages_js():
    with open(PAGES_JS, encoding="utf-8") as f:
        text = f.read()
    m = re.search(r"export\s+const\s+LIBRARY\s*=", text)
    if not m:
        raise PagesJsError("Couldn't find 'export const LIBRARY =' in pages.js")
    reader = JsReader(text, m.end())
    library = reader.value()
    reader.skip_space()
    if reader.s.startswith(";", reader.i):
        reader.i += 1
    check_library(library)
    return library, text[:m.start()], text[reader.i:]


def check_library(library):
    if not isinstance(library, list):
        raise PagesJsError("LIBRARY in pages.js should be a list [ ... ]")
    for cat in library:
        if not (isinstance(cat, dict) and "folder" in cat and isinstance(cat.get("subcategories"), list)):
            raise PagesJsError("Every category needs a name, folder and subcategories list")
        for sub in cat["subcategories"]:
            if not (isinstance(sub, dict) and "folder" in sub and isinstance(sub.get("pages"), list)):
                raise PagesJsError(f"A sub-category in '{cat.get('name')}' needs a name, folder and pages list")


def js_text(value):
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, dict):
        parts = []
        for k, v in value.items():
            key = k if JsReader.KEY.fullmatch(k) else json.dumps(k)
            parts.append(f"{key}: {js_text(v)}")
        return "{ " + ", ".join(parts) + " }"
    if isinstance(value, list):
        return "[" + ", ".join(js_text(v) for v in value) + "]"
    return json.dumps(value)


def extra_fields(obj, known):
    return "".join(f", {k}: {js_text(v)}" for k, v in obj.items() if k not in known)


def write_pages_js(library, header, trailer):
    lines = ["export const LIBRARY = ["]
    for cat in library:
        lines.append("  {")
        lines.append(f"    name: {js_text(cat.get('name', cat['folder']))},")
        lines.append(f"    folder: {js_text(cat['folder'])},")
        for k, v in cat.items():
            if k not in ("name", "folder", "subcategories"):
                lines.append(f"    {k}: {js_text(v)},")
        lines.append("    subcategories: [")
        for sub in cat["subcategories"]:
            lines.append(f"      {{ name: {js_text(sub.get('name', sub['folder']))}, folder: {js_text(sub['folder'])}"
                         f"{extra_fields(sub, ('name', 'folder', 'pages'))}, pages: [")
            for page in sub["pages"]:
                lines.append(f"        {js_text(page)},")
            lines.append("      ]},")
        lines.append("    ],")
        lines.append("  },")
    lines.append("];")
    text = header + "\n".join(lines) + "\n" + trailer.lstrip("\n")
    temp = PAGES_JS + ".tmp"
    with open(temp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(temp, PAGES_JS)  # swap in all at once, so a crash can't leave half a file


def page_file_name(entry):
    return entry if isinstance(entry, str) else entry.get("file", "")


# ============================================================ MAIN ===========

def find_images():
    """Returns (images to import, problems). Images must be in import/<category>/<sub>/."""
    found, problems = [], []
    for folder, dirs, files in os.walk(IMPORT_DIR):
        dirs[:] = sorted(d for d in dirs if not d.startswith("."))
        rel = os.path.relpath(folder, IMPORT_DIR)
        parts = [] if rel == "." else rel.replace("\\", "/").split("/")
        for name in sorted(files):
            if name.startswith(".") or name.lower() in ("how-to.txt", "desktop.ini", "thumbs.db"):
                continue
            shown = "/".join(parts + [name])
            ext = os.path.splitext(name)[1].lower()
            if ext not in IMAGE_TYPES:
                problems.append((shown, "not a PNG, JPG or WEBP image"))
            elif len(parts) != 2:
                problems.append((shown, "must be inside import/<category>/<sub-category>/"))
            else:
                found.append((os.path.join(folder, name), parts[0], parts[1], shown))
    return found, problems


def load_log():
    try:
        with open(LOG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"pages": {}}


def save_log(log):
    with open(LOG_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(log, f, indent=2, sort_keys=True)
        f.write("\n")


def main():
    if not os.path.isdir(IMPORT_DIR):
        os.makedirs(IMPORT_DIR)
        print("Created the 'import' folder. Put images in import/<category>/<sub-category>/")
        print("for example import/Flowers/Roses/, then run this again.")
        return

    try:
        library, header, trailer = read_pages_js()
    except PagesJsError as e:
        print(f"Problem reading pages.js: {e}")
        print("Nothing was imported. Fix pages.js (or undo your last change to it) and try again.")
        return

    images, problems = find_images()
    if not images and not problems:
        print("The import folder is empty. Put images in import/<category>/<sub-category>/ first.")
        return

    log = load_log()
    pages_log = log.setdefault("pages", {})
    # Names already used anywhere in the library (they must be unique).
    taken = set()
    for cat in library:
        for sub in cat["subcategories"]:
            for entry in sub["pages"]:
                taken.add(os.path.splitext(page_file_name(entry))[0])
    for _, _, files in os.walk(PAGES_DIR):
        taken.update(os.path.splitext(f)[0] for f in files)
    # Only remember pages that still exist (deleted pages may be imported again).
    known = {pid: info for pid, info in pages_log.items() if pid in taken}

    added, already, duplicates = [], [], []
    total = len(images)
    for n, (path, cat_folder_raw, sub_folder_raw, shown) in enumerate(images, 1):
        print(f"[{n}/{total}] {shown} ... ", end="", flush=True)

        digest = file_hash(path)
        same_file = next((pid for pid, info in known.items() if info.get("sha256") == digest), None)
        if same_file:
            print(f"already imported as {same_file}")
            already.append(shown)
            continue

        try:
            page_img, notes = clean_page(path)
        except Skip as why:
            print("skipped")
            problems.append((shown, str(why)))
            continue
        except Exception as e:  # anything unexpected: report it and keep going
            print("skipped")
            problems.append((shown, f"unexpected error: {e}"))
            continue

        print_ = fingerprint(page_img)
        twin = next((pid for pid, info in known.items() if looks_same(info.get("fingerprint", ""), print_)), None)
        if twin:
            print(f"skipped, looks the same as {twin}")
            duplicates.append((shown, twin))
            continue

        # Find (or create) the category and sub-category.
        cat_name, sub_name = display_name(cat_folder_raw), display_name(sub_folder_raw)
        if not slugify(cat_name) or not slugify(sub_name):
            print("skipped")
            problems.append((shown, "its folder names need some letters or numbers"))
            continue
        category = find_group(library, cat_folder_raw)
        if category is None:
            category = {"name": cat_name, "folder": slugify(cat_name), "subcategories": []}
            library.append(category)
        sub = find_group(category["subcategories"], sub_folder_raw)
        if sub is None:
            sub = {"name": sub_name, "folder": slugify(sub_name), "pages": []}
            category["subcategories"].append(sub)

        name = nice_page_name(os.path.splitext(os.path.basename(path))[0], sub["folder"], taken)
        out_dir = os.path.join(PAGES_DIR, category["folder"], sub["folder"])
        os.makedirs(out_dir, exist_ok=True)
        page_img.save(os.path.join(out_dir, name + ".png"), optimize=True)
        sub["pages"].append(name + ".png")

        info = {"source": shown, "sha256": digest, "fingerprint": print_}
        pages_log[name] = info
        known[name] = info
        added.append((f"{category.get('name')} > {sub.get('name')}", name + ".png", notes))
        print("added as " + name + ".png" + (f"  ({'; '.join(notes)})" if notes else ""))

        # Save as we go, so an interruption never loses finished pages.
        write_pages_js(library, header, trailer)
        save_log(log)

    # ------------------------------------------------------------ summary --
    print()
    print("=" * 60)
    if added:
        print(f"ADDED {len(added)} page{'s' if len(added) != 1 else ''}:")
        for where in dict.fromkeys(w for w, _, _ in added):
            print(f"  {where}: " + ", ".join(f for w, f, _ in added if w == where))
    else:
        print("No new pages added.")
    if already:
        print(f"Already imported before (skipped): {len(already)}")
    if duplicates:
        print(f"Skipped as duplicates: {len(duplicates)}")
        for shown, twin in duplicates:
            print(f"  {shown}  (same as {twin})")
    if problems:
        print(f"COULDN'T IMPORT {len(problems)}:")
        for shown, why in problems:
            print(f"  {shown}: {why}")
    print("=" * 60)
    if added:
        print("Your original images were not changed. Check the new pages in the app,")
        print("then make a checkpoint and upload it so they appear on her iPad.")


if __name__ == "__main__":
    main()
