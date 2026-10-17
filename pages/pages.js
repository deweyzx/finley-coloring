// THE LIST OF COLORING PAGES
//
// To add a page:
//   1. Put the image file in this "pages" folder (PNG recommended, see README.md).
//   2. Add a line below with:
//        id    - a short unique name. NEVER change it later: her saved coloring is stored under this id.
//        title - the name shown in the gallery.
//        file  - where the image is, starting with "pages/".
//
// The order here is the order they appear in the gallery.

export const PAGES = [
  { id: "flower",    title: "Flower",    file: "pages/flower.svg" },
  { id: "mandala",   title: "Mandala",   file: "pages/mandala.svg" },
  { id: "butterfly", title: "Butterfly", file: "pages/butterfly.svg" },
  { id: "shapes",    title: "Shapes",    file: "pages/shapes.svg" },
  { id: "cottage",   title: "Cottage",   file: "pages/cottage.svg" },
];
