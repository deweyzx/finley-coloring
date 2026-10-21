// themes.js - appearance only. Storybook is the first theme; add the next theme only after
// Owen has tested this selector. Painting, palettes and the white artwork paper are separate.
import { openModal, closeModal } from './modal.js?v=20261021174002';

export const THEMES = [{id:'storybook', name:'Storybook', description:'Forest-green leather, warm parchment and gold.'}];
const KEY = 'theme';
const root = document.documentElement;
const button = document.getElementById('themes-button');
const backdrop = document.getElementById('themes-dialog');
const status = document.getElementById('theme-status');
let selected = THEMES[0];
try { selected = THEMES.find(theme => theme.id === localStorage.getItem(KEY)) || selected; }
catch { /* Appearance still works when browser settings prevent saving a preference. */ }

// Cards come from this one list. A later theme needs its own CSS material/preview block and
// one list entry; its preview doesn't borrow the currently selected theme's colors.
const choices = backdrop.querySelector('.theme-choices');
for (const theme of THEMES) {
  const card = document.createElement('button');
  card.type = 'button'; card.className = 'theme-card'; card.setAttribute('role', 'radio');
  card.dataset.themeChoice = theme.id;
  card.setAttribute('aria-labelledby', `theme-${theme.id}-name`);
  card.setAttribute('aria-describedby', `theme-${theme.id}-description`);
  card.innerHTML = '<span class="theme-preview" aria-hidden="true"><span class="theme-preview-rule"></span><img src="icons/icon-192.png" alt="" width="84" height="84"><span class="theme-preview-pages"></span></span><span class="theme-copy"><span class="theme-name"></span><span class="theme-check" aria-hidden="true">✓</span><span class="theme-description"></span></span>';
  card.querySelector('.theme-preview').dataset.themePreview = theme.id;
  const name = card.querySelector('.theme-name'), description = card.querySelector('.theme-description');
  name.id = `theme-${theme.id}-name`; name.textContent = theme.name;
  description.id = `theme-${theme.id}-description`; description.textContent = theme.description;
  choices.append(card);
}

function apply(theme) {
  selected = theme;
  root.dataset.theme = theme.id;
  const background = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  button.setAttribute('aria-label', `Themes: ${theme.name}`);
  for (const choice of backdrop.querySelectorAll('[data-theme-choice]')) {
    const active = choice.dataset.themeChoice === theme.id;
    choice.setAttribute('aria-checked', String(active));
    choice.classList.toggle('selected', active);
  }
}

function close() { closeModal(backdrop); button.setAttribute('aria-expanded','false'); }
button.addEventListener('click', () => {
  status.textContent = `${selected.name} is your current look.`;
  openModal(backdrop, {onClose:close, initialFocus:backdrop.querySelector('[aria-checked="true"]')});
  button.setAttribute('aria-expanded','true');
});
for (const id of ['themes-close','themes-done']) document.getElementById(id).addEventListener('click', close);
backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
for (const choice of backdrop.querySelectorAll('[data-theme-choice]')) choice.addEventListener('click', () => {
  const theme = THEMES.find(item => item.id === choice.dataset.themeChoice);
  if (!theme) return;
  apply(theme);
  try {
    localStorage.setItem(KEY, theme.id);
    status.textContent = `${theme.name} is selected and remembered on this device.`;
  } catch {
    status.textContent = `${theme.name} is selected for this visit. This browser couldn't remember the choice.`;
  }
});
apply(selected);
