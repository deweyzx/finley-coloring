// gallery.js - draws the grid of page cards.
// For now each card shows the blank page. In a later step it will show her saved progress.

const grid = document.getElementById("gallery-grid");

export function renderGallery(pages, onPick) {
  grid.replaceChildren(); // clear out any old cards

  for (const page of pages) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "page-card";

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = page.file;
    img.alt = "";
    img.draggable = false;
    thumb.append(img);

    const name = document.createElement("span");
    name.className = "page-name";
    name.textContent = page.title;

    card.append(thumb, name);
    card.addEventListener("click", () => onPick(page));
    grid.append(card);
  }
}
