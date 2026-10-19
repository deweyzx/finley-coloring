// lineart.js - loads a coloring page image and turns it into a "line art layer":
// black lines that stay, and white areas that become see-through, so the colors
// painted on the layer underneath show through.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

// Draws the image onto `canvas` (which must already be the right size), then
// converts it: dark pixels -> black and solid, light pixels -> transparent.
// Grey edge pixels (the soft "anti-aliased" edges of lines) become partly
// transparent black, so lines stay smooth.
// Returns how dark each pixel is (0 = paper, 255 = black), which tap-to-fill uses.
export function drawLineArt(canvas, img) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = imageData.data; // [r, g, b, a, r, g, b, a, ...] one group of 4 per pixel
  const darknessMap = new Uint8Array(canvas.width * canvas.height);

  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const brightness = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; // 0 = black, 255 = white
    const coverage = px[i + 3] / 255; // already-transparent pixels count as white
    const darkness = (255 - brightness) * coverage;
    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = darkness;
    darknessMap[p] = darkness;
  }

  ctx.putImageData(imageData, 0, 0);
  return darknessMap;
}
