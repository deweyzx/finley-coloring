// THE COLORING PAGE LIBRARY
//
// Folders on disk match this list:   pages/<category folder>/<sub-category folder>/<file>
//   e.g. pages/flowers/roses/red-rose.png
//
// TO ADD A PAGE: drop the file into its sub-category folder, then add the file name
// to that sub-category's "pages" list below. The title shown in the app is made from
// the file name ("red-rose.png" -> "Red Rose"). To pick your own title instead, write
//   { file: "red-rose.png", title: "My Favorite Rose" }
//
// TO ADD A SUB-CATEGORY or CATEGORY: make the folder, then copy one of the blocks below.
//
// RULES:
//   - Every file name must be unique across the WHOLE library (her saved coloring is
//     stored under the file name). The app shows a warning if two match.
//   - Don't rename a file once she has colored it, or her progress on it is lost.
//     Moving it to another folder is fine.
//   - Folder names: lowercase, no spaces (use dashes). "name" is what she sees.
//   - The order here is the order shown in the app.

export const LIBRARY = [
  {
    name: "Flowers",
    folder: "flowers",
    subcategories: [
      { name: "Sunflowers", folder: "sunflowers", pages: [
        "sunflower.svg",
      ]},
      { name: "Tulips", folder: "tulips", pages: [
        "tulips.svg",
      ]},
    ],
  },
  {
    name: "Animals",
    folder: "animals",
    subcategories: [
      { name: "Butterflies", folder: "butterflies", pages: [
        "butterfly.svg",
      ]},
    ],
  },
  {
    name: "Patterns",
    folder: "patterns",
    subcategories: [
      { name: "Mandalas", folder: "mandalas", pages: [
        "mandala.svg",
        "star-mandala.svg",
      ]},
      { name: "Shapes", folder: "shapes", pages: [
        { file: "shapes.svg", title: "Simple Shapes" },
      ]},
    ],
  },
  {
    name: "Places",
    folder: "places",
    subcategories: [
      { name: "Houses", folder: "houses", pages: [
        "cottage.svg",
      ]},
    ],
  },
];
