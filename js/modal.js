// modal.js - shared focus/accessibility behavior for the app's windows.
// Only the top window can receive keyboard/touch input. Closing a palette name box returns
// to the picker; it must not also close the picker or leave drawing controls focused behind it.
const stack = [];
const blocked = new Map();
let focusFrame;
const SELECTABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const visible = node => node?.isConnected && node.getClientRects().length && !node.closest('[hidden], [inert]');
const controls = node => [...node.querySelectorAll(SELECTABLE)].filter(item => item.tabIndex >= 0 && visible(item));
export const modalIsOpen = () => stack.length > 0;

function sync() {
  for (const [node, previous] of blocked) node.inert = previous;
  blocked.clear();
  for (const entry of stack) entry.box.setAttribute('aria-modal', String(entry === stack.at(-1)));
  const top = stack.at(-1);
  if (!top) return;
  // A picker lives inside the coloring screen, while a naming box is attached to body.
  // Block siblings up the ancestry, never the top window's own parent.
  for (let node = top.backdrop; node.parentElement && node.parentElement !== document.documentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || !(sibling instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
      if (!blocked.has(sibling)) blocked.set(sibling, sibling.inert);
      sibling.inert = true;
    }
  }
}

function focusInside(entry) {
  const preferred = typeof entry.initialFocus === 'function' ? entry.initialFocus() : entry.initialFocus;
  const target = visible(preferred) && !preferred.disabled ? preferred : controls(entry.backdrop)[0] || entry.box;
  target.focus({preventScroll:true});
}

export function openModal(backdrop, {onClose, initialFocus, returnFocus} = {}) {
  if (stack.some(entry => entry.backdrop === backdrop)) return;
  const box = backdrop.querySelector('[role="dialog"], [role="alertdialog"]') || backdrop.firstElementChild;
  const entry = {backdrop, box, onClose:onClose || (() => closeModal(backdrop)), initialFocus,
    returnFocus:returnFocus || document.activeElement};
  box.tabIndex = -1;
  backdrop.hidden = false;
  backdrop.style.setProperty('--modal-depth', stack.length);
  stack.push(entry); sync(); focusInside(entry);
}

export function closeModal(backdrop) {
  const index = stack.findIndex(entry => entry.backdrop === backdrop);
  if (index < 0) { backdrop.hidden = true; return; }
  const removed = stack.splice(index);
  cancelAnimationFrame(focusFrame);
  for (const entry of removed) { entry.backdrop.hidden = true; entry.box.removeAttribute('aria-modal'); }
  sync();
  const previous = removed[0].returnFocus;
  if (visible(previous) && !previous.disabled) previous.focus({preventScroll:true});
  else if (stack.length) focusInside(stack.at(-1));
}

document.addEventListener('keydown', event => {
  const top = stack.at(-1);
  if (!top) return;
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopImmediatePropagation(); top.onClose();
  } else if (event.key === 'Tab') {
    const items = controls(top.backdrop), first = items[0], last = items.at(-1);
    if (!items.length) { event.preventDefault(); top.box.focus({preventScroll:true}); return; }
    if (!items.includes(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
      event.preventDefault(); (event.shiftKey ? last : first).focus({preventScroll:true});
    }
  }
}, true);

function keepVisible(top, target) {
    cancelAnimationFrame(focusFrame);
    if (target === top.box) return;
    focusFrame = requestAnimationFrame(() => {
      if (stack.at(-1) !== top || !visible(target)) return;
      const footer = top.box.querySelector(':scope > .dialog-buttons');
      if (footer?.contains(target)) return;
      const box = top.box.getBoundingClientRect(), item = target.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(top.box).getPropertyValue('--modal-gap'));
      const heading = top.box.querySelector('.app-heading');
      const above = heading && !heading.contains(target) ? heading.getBoundingClientRect().bottom + gap : box.top + gap;
      const below = Math.min(box.bottom, footer?.getBoundingClientRect().top ?? box.bottom) - gap;
      // Browser focus scrolling doesn't account for a sticky footer. Keep a focused action
      // above Done instead of letting the footer cover it in a long palette/window.
      if (item.bottom > below) top.box.scrollTop += item.bottom - below;
      else if (item.top < above) top.box.scrollTop -= above - item.top;
    });
}

document.addEventListener('focusin', event => {
  const top = stack.at(-1);
  if (top && !top.backdrop.contains(event.target)) focusInside(top);
  else if (top) keepVisible(top, event.target);
});

// Rotation can move a focused action underneath the footer without changing focus.
const resized = () => {
  const top = stack.at(-1);
  if (top?.backdrop.contains(document.activeElement)) keepVisible(top, document.activeElement);
};
window.addEventListener('resize', resized);

// Browser Back can change the screen without tapping a button in the app. Ask each window
// to close normally; a busy backup/update can decline through its existing close function.
window.addEventListener('hashchange', () => queueMicrotask(() => {
  let remaining = stack.length;
  while (stack.length && remaining-- > 0) {
    const top = stack.at(-1); top.onClose();
    if (stack.at(-1) === top) break;
  }
}));
