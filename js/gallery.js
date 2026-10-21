// gallery.js - the library screens: all categories -> one category -> one sub-category.
// They all use the same grid of cards; only the cards and the header change.

import { categories, coverPage, problems } from "./library.js?v=20261021020853";
import { getThumbnailURL } from "./thumbnails.js?v=20261021020853";
import { getPreviewURL, getProgressTimes, previewsReady } from "./autosave.js?v=20261021020853";

const grid = document.getElementById("gallery-grid");
const titleEl = document.getElementById("library-title");
const crumbEl = document.getElementById("library-crumb");
const backLink = document.getElementById("library-back");
const noticeEl = document.getElementById("library-notice");

const APP_NAME = "Finley's Coloring Book";

// Shows a warning if pages.js has a mistake, so you notice it while testing.
if (problems.length) {
  noticeEl.textContent = problems.join(" ");
  noticeEl.hidden = false;
}

export function showLibrary() {
  setHeader(APP_NAME, "", null);
  renderCards(categories.map((cat) => ({
    title: cat.name,
    detail: countText(cat.pageCount),
    cover: coverPage(cat),
    pages: cat.subcategories.flatMap((sub) => sub.pages),
    href: `#/${cat.folder}`,
    stacked: true,
  })));
}

export function showCategory(cat) {
  setHeader(cat.name, "", "#/");
  renderCards(cat.subcategories.map((sub) => ({
    title: sub.name,
    detail: countText(sub.pages.length),
    cover: coverPage(sub),
    pages: sub.pages,
    href: `#/${cat.folder}/${sub.folder}`,
    stacked: true,
  })));
}

export function showSubcategory(sub) {
  setHeader(sub.name, sub.category.name, `#/${sub.category.folder}`);
  renderCards(sub.pages.map((page) => ({
    title: page.title,
    cover: page,
    pages: [page],
    href: `#/page/${encodeURIComponent(page.id)}`,
  })));
}

function setHeader(title, crumb, backHref) {
  titleEl.textContent = title;
  crumbEl.textContent = crumb;
  crumbEl.hidden = !crumb;
  backLink.hidden = !backHref;
  if (backHref) backLink.href = backHref;
}

function countText(n) {
  return n === 1 ? "1 page" : `${n} pages`;
}

// ---------- Cards ----------

// Watches which cards are on (or near) the screen, so thumbnails are only
// loaded for cards she can actually see. Scrolling loads more as needed.
let observer = null;
let renderCount = 0;

// Every card shows her coloring if she has colored it: a page card shows that page; a
// category or sub-category card shows the page in it she colored most recently. Pages she
// hasn't touched show the blank page.
async function renderCards(cards) {
  const thisRender = ++renderCount;
  await previewsReady();
  const times = await getProgressTimes();
  if (thisRender !== renderCount) return; // she has already moved to another screen
  for (const card of cards) {
    const colored = (card.pages || []).filter((p) => times.has(p.id));
    colored.sort((a, b) => times.get(b.id) - times.get(a.id));
    card.colored = colored[0] || null;
  }

  if (observer) observer.disconnect();
  observer = new IntersectionObserver(onCardsVisible, { root: grid, rootMargin: "400px 0px" });

  grid.replaceChildren();
  grid.scrollTop = 0;

  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "No pages here yet.";
    grid.append(empty);
    return;
  }

  for (const card of cards) {
    const el = makeCard(card);
    grid.append(el);
    if (card.colored) {
      showColoredPreview(el, card);
      continue;
    }
    if (!card.cover) continue;
    if (card.cover.thumb) {
      // A ready-made thumbnail file: the browser loads it when the card scrolls near the screen.
      const img = el.querySelector("img");
      img.loading = "lazy";
      img.onload = () => img.classList.add("loaded");
      img.onerror = () => observer.observe(el); // missing? make one from the full page instead
      img.src = card.cover.thumb;
    } else {
      observer.observe(el);
    }
  }
}

// Shows her colored version on a card (falls back to the blank page if it can't be read).
function showColoredPreview(el, card) {
  const img = el.querySelector("img");
  img.onload = () => img.classList.add("loaded");
  getPreviewURL(card.colored.id).then((url) => {
    if (url) {
      img.src = url;
    } else if (card.cover && card.cover.thumb) {
      img.src = card.cover.thumb;
    } else {
      observer.observe(el);
    }
  });
}

function makeCard({ title, detail, cover, href, stacked }) {
  // Cards are links, so tapping one just changes the address (#/flowers/...),
  // and app.js shows the matching screen.
  const card = document.createElement("a");
  card.className = stacked ? "page-card stacked" : "page-card";
  card.href = href;
  if (cover) card.dataset.file = cover.file;

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  thumb.append(img);

  const name = document.createElement("span");
  name.className = "page-name";
  name.textContent = title;
  card.append(thumb, name);

  if (detail) {
    const small = document.createElement("span");
    small.className = "card-detail";
    small.textContent = detail;
    card.append(small);
  }
  return card;
}

function onCardsVisible(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const card = entry.target;
    observer.unobserve(card); // only needs loading once
    const img = card.querySelector("img");
    getThumbnailURL(card.dataset.file)
      .then((url) => {
        img.onload = () => img.classList.add("loaded");
        img.src = url;
      })
      .catch((err) => {
        card.classList.add("missing");
        console.error(err);
      });
  }
}
