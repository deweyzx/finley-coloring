// gallery.js - the library screens: all categories -> one category -> one sub-category.
// They all use the same grid of cards; only the cards and the header change.

import { categories, coverPage, problems, findPage } from "./library.js?v=20261021162959";
import { getThumbnailURL } from "./thumbnails.js?v=20261021162959";
import { getPreviewURL, getProgressTimes, previewsReady } from "./autosave.js?v=20261021162959";

const grid = document.getElementById("gallery-grid");
const titleEl = document.getElementById("library-title");
const crumbEl = document.getElementById("library-crumb");
const backLink = document.getElementById("library-back");
const noticeEl = document.getElementById("library-notice");
const sectionTitle = document.getElementById("library-section-title");
const scroll = document.getElementById("library-scroll");
const continueCard = document.getElementById("continue-card");

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
  })), true);
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
  titleEl.textContent = APP_NAME;
  sectionTitle.textContent = backHref ? title : "Collections";
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
async function renderCards(cards, home = false) {
  const thisRender = ++renderCount;
  continueCard.hidden = true;
  await previewsReady();
  const times = await getProgressTimes();
  if (thisRender !== renderCount) return; // she has already moved to another screen
  for (const card of cards) {
    const colored = (card.pages || []).filter((p) => times.has(p.id));
    colored.sort((a, b) => times.get(b.id) - times.get(a.id));
    card.colored = colored[0] || null;
    card.started = colored.length;
    card.pageCount = card.pages?.length || 1;
    if (card.stacked) card.detail = countText(card.pageCount) + (card.started ? `, ${card.started} started` : "");
  }

  if (observer) observer.disconnect();
  observer = new IntersectionObserver(onCardsVisible, { root: scroll, rootMargin: "400px 0px" });

  grid.replaceChildren();
  scroll.scrollTop = 0;
  if (home) showContinue(times, thisRender);

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
  const fallback = () => {
    img.onerror = null;
    if (card.cover?.thumb) img.src = card.cover.thumb;
    else observer?.observe(el);
  };
  img.onerror = fallback; // an unreadable restored preview mustn't leave an empty card
  getPreviewURL(card.colored.id).then((url) => {
    if (url) {
      img.src = url;
    } else if (card.cover && card.cover.thumb) {
      img.src = card.cover.thumb;
    } else {
      observer.observe(el);
    }
  }).catch(fallback);
}

function makeCard({ title, detail, cover, href, pageCount, started }) {
  // Cards are links, so tapping one just changes the address (#/flowers/...),
  // and app.js shows the matching screen.
  const card = document.createElement("a");
  card.className = "page-card" + (pageCount > 1 ? " stacked" : "") + (started ? " in-progress" : "");
  card.href = href;
  card.setAttribute("aria-label", title + (detail ? `, ${detail}` : started ? ", in progress" : ""));
  if (cover) card.dataset.file = cover.file;

  const stack = document.createElement("div");
  stack.className = "collection-stack";
  // A single page is a single sheet; collections with more pages get sheets underneath.
  for (let n = 1; n <= Math.min(2, pageCount - 1); n++) {
    const under = document.createElement("span");
    under.className = `sheet-under sheet-${n}`;
    under.setAttribute("aria-hidden", "true");
    stack.append(under);
  }
  const thumb = document.createElement("div");
  thumb.className = "thumb";
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  thumb.append(img);
  stack.append(thumb);
  if (started) {
    const ribbon = document.createElement("span");
    ribbon.className = "ribbon";
    ribbon.setAttribute("aria-hidden", "true");
    stack.append(ribbon);
  }

  const name = document.createElement("span");
  name.className = "page-name";
  name.textContent = title;
  card.append(stack, name);

  if (detail) {
    const small = document.createElement("span");
    small.className = "card-detail";
    small.textContent = detail;
    card.append(small);
  }
  return card;
}

// Use the existing small progress records, not full page images, for the continue card.
// If a page was removed from the library, continue with the newest page that still exists.
async function showContinue(times, render) {
  const newest = [...times].filter(([id]) => findPage(id)).sort((a, b) => b[1] - a[1])[0];
  if (!newest) return;
  const [id, updated] = newest, page = findPage(id);
  const url = await getPreviewURL(id).catch(() => null);
  if (render !== renderCount) return;
  const image = document.getElementById("continue-image");
  const fallback = () => {
    image.onerror = null;
    if (page.thumb) image.src = page.thumb;
    else getThumbnailURL(page.file).then(src => { if (render === renderCount) image.src = src; }).catch(() => {});
  };
  image.classList.remove("loaded");
  image.onload = () => image.classList.add("loaded");
  image.onerror = fallback;
  image.alt = `Your coloring of ${page.title}`;
  if (url) image.src = url; else fallback();
  document.getElementById("continue-title").textContent = page.title;
  document.getElementById("continue-meta").textContent = `${page.subcategory.category.name}, colored ${whenColored(updated)}`;
  document.getElementById("continue-open").href = `#/page/${encodeURIComponent(id)}`;
  continueCard.hidden = false;
}

function whenColored(updated) {
  const day = date => new Date(date).setHours(0, 0, 0, 0);
  const days = Math.round((day(Date.now()) - day(updated)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return "on " + new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(updated));
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
