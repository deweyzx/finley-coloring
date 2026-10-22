// library.js - reads the list in pages/pages.js and fills in the details the app needs
// (full file path, id, title), so the list itself can stay short and easy to edit.

import { LIBRARY } from "../pages/pages.js?v=20261022001928";

export const categories = [];
const pagesById = new Map();
export const problems = []; // mistakes found in pages.js, shown at the top of the library

for (const cat of LIBRARY) {
  const category = { name: cat.name, folder: cat.folder, subcategories: [], pageCount: 0 };

  for (const sub of cat.subcategories) {
    const subcategory = { name: sub.name, folder: sub.folder, category, pages: [] };

    for (const entry of sub.pages) {
      // An entry is either "file.png" or { file: "file.png", title: "..." }.
      const fileName = typeof entry === "string" ? entry : entry.file;
      const id = fileName.replace(/\.[^.]+$/, ""); // file name without ".png"
      const page = {
        id,
        title: (typeof entry === "object" && entry.title) || titleFromId(id),
        file: `pages/${cat.folder}/${sub.folder}/${fileName}`,
        // Small preview made by the import tool (not for SVG pages; the app makes those itself).
        thumb: /\.svg$/i.test(fileName) ? null : `thumbs/${cat.folder}/${sub.folder}/${id}.png`,
        subcategory,
      };

      if (pagesById.has(id)) {
        problems.push(`Two pages are named "${id}". Rename one of them so each name is unique.`);
        continue;
      }
      pagesById.set(id, page);
      subcategory.pages.push(page);
    }

    category.subcategories.push(subcategory);
    category.pageCount += subcategory.pages.length;
  }

  categories.push(category);
}

export function findCategory(folder) {
  return categories.find((c) => c.folder === folder);
}

export function findSubcategory(category, folder) {
  return category.subcategories.find((s) => s.folder === folder);
}

export function findPage(id) {
  return pagesById.get(id);
}

// The first page of a category or sub-category is used as its cover picture.
export function coverPage(group) {
  if (group.pages) return group.pages[0];
  for (const sub of group.subcategories) {
    if (sub.pages.length) return sub.pages[0];
  }
  return undefined;
}

// "red-rose" -> "Red Rose"
function titleFromId(id) {
  return id
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
