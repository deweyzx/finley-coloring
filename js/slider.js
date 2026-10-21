// slider.js - a big, Pencil-friendly slider.
// Tap or drag anywhere along it (not just on the knob) to set the value.
//
// createSlider(element, options) fills `element` with the slider and returns { set(value) }.
//   label    - text shown on the left ("Size")
//   min, max - the range
//   curve    - 1 = even steps; 2 = finer control at the small end (good for brush size)
//   format   - turns a value into the text shown on the right
//   onChange - called with the new value while she drags

export function createSlider(element, { label, min, max, curve = 1, format = String, onChange }) {
  element.classList.add("slider");
  element.innerHTML = `
    <span class="slider-label"></span>
    <div class="slider-track">
      <div class="slider-fill"></div>
      <div class="slider-thumb"></div>
    </div>
    <span class="slider-value"></span>`;
  const labelEl = element.querySelector(".slider-label");
  const track = element.querySelector(".slider-track");
  const fill = element.querySelector(".slider-fill");
  const thumb = element.querySelector(".slider-thumb");
  const valueEl = element.querySelector(".slider-value");
  labelEl.textContent = label;
  element.setAttribute("role", "slider");
  element.setAttribute("aria-label", label);
  element.tabIndex = 0;

  let range = { min, max };
  let value = min;

  const toPosition = (v) => Math.pow((v - range.min) / (range.max - range.min), 1 / curve);
  const fromPosition = (t) => range.min + (range.max - range.min) * Math.pow(t, curve);

  function show() {
    const t = Math.min(1, Math.max(0, toPosition(value)));
    fill.style.width = `${t * 100}%`;
    thumb.style.left = `${t * 100}%`;
    valueEl.textContent = format(value);
    element.setAttribute("aria-valuenow", String(value));
    element.setAttribute("aria-valuetext", format(value));
    element.setAttribute("aria-valuemin", String(range.min));
    element.setAttribute("aria-valuemax", String(range.max));
  }

  function setFromPointer(e) {
    const box = track.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    value = fromPosition(t);
    show();
    onChange(value);
  }

  element.addEventListener("pointerdown", (e) => {
    if (element.getAttribute("aria-disabled") === "true") return;
    element.setPointerCapture(e.pointerId);
    setFromPointer(e);
  });
  element.addEventListener("pointermove", (e) => {
    if (element.hasPointerCapture(e.pointerId)) setFromPointer(e);
  });
  element.addEventListener("keydown", (e) => {
    if (element.getAttribute("aria-disabled") === "true") return;
    const steps = { ArrowRight: 0.01, ArrowUp: 0.01, ArrowLeft: -0.01, ArrowDown: -0.01, PageUp: 0.1, PageDown: -0.1 };
    if (!(e.key in steps) && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const t = e.key === "Home" ? 0 : e.key === "End" ? 1 : Math.min(1, Math.max(0, toPosition(value) + steps[e.key]));
    value = fromPosition(t);
    show();
    onChange(value);
  });

  return {
    set(v, newRange) {
      if (newRange) range = newRange;
      value = v;
      show();
    },
  };
}
