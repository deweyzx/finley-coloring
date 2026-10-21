// dialogs.js - small question boxes in the app's own style (instead of the browser's plain
// pop-ups): one that asks for a name, and one that asks "are you sure?".
//
//   const name = await askText({ title: "Name your palette", value: "My colors" });
//   // -> the text she typed, or null if she cancelled
//   const yes = await askConfirm({ title: "Delete it?", confirmLabel: "Delete", danger: true });
//   // -> true or false

import { openModal, closeModal } from './modal.js?v=20261021174002';

let nextHeading = 0;
function build({ title, text, body, buttons }) {
  const backdrop = document.createElement("div");
  backdrop.className = "dialog-backdrop dialog-top";
  const box = document.createElement("div");
  box.className = "dialog";
  box.setAttribute("role", "alertdialog");
  const heading = document.createElement("h2");
  heading.textContent = title;
  heading.id = `question-heading-${++nextHeading}`;
  box.setAttribute('aria-labelledby', heading.id);
  box.append(heading);
  if (text) {
    const p = document.createElement("p");
    p.id = `question-text-${nextHeading}`;
    box.setAttribute('aria-describedby', p.id);
    p.textContent = text;
    box.append(p);
  }
  if (body) box.append(body);
  const row = document.createElement("div");
  row.className = "dialog-buttons";
  for (const b of buttons) row.append(b);
  box.append(row);
  backdrop.append(box);
  document.body.append(backdrop);
  return backdrop;
}

function makeButton(label, className = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "dialog-button " + className;
  b.textContent = label;
  return b;
}

export function askConfirm({ title, text, confirmLabel = "OK", cancelLabel = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const cancel = makeButton(cancelLabel, 'secondary');
    const ok = makeButton(confirmLabel, danger ? "danger" : "");
    const backdrop = build({ title, text, buttons: [cancel, ok] });
    const finish = (answer) => {
      closeModal(backdrop);
      backdrop.remove();
      resolve(answer);
    };
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(false);
    });
    openModal(backdrop, {onClose:() => finish(false), initialFocus:cancel}); // safe choice
  });
}

export function askText({ title, text, value = "", maxLength = 24, confirmLabel = "Save", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "dialog-input";
    input.value = value;
    input.maxLength = maxLength;
    input.setAttribute("enterkeyhint", "done");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-label", title);
    const cancel = makeButton(cancelLabel, 'secondary');
    const ok = makeButton(confirmLabel);
    const backdrop = build({ title, text, body: input, buttons: [cancel, ok] });
    const finish = (answer) => {
      closeModal(backdrop);
      backdrop.remove();
      resolve(answer);
    };
    const accept = () => {
      const name = input.value.replace(/\s+/g, " ").trim();
      if (name) finish(name);
      else input.focus(); // a name is needed
    };
    cancel.addEventListener("click", () => finish(null));
    ok.addEventListener("click", accept);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") accept();
    });
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(null);
    });
    openModal(backdrop, {onClose:() => finish(null), initialFocus:input});
    input.select();
  });
}
