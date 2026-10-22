// themes.js - appearance only. Themes arrive one at a time for Owen and Finley to test.
// Painting, palettes and the white artwork paper are separate from this device preference.
import { openModal, closeModal } from './modal.js?v=20261022011129';

export const THEMES = [
  {id:'storybook', name:'Storybook', description:'Forest-green leather, warm parchment and gold.'},
  {id:'midnight-forest', name:'Midnight Forest', description:'Deep forest greens, silver ivy and soft moonlight.'},
  {id:'ocean-dreams', name:'Ocean Dreams', description:'Sea-glass blue, gentle teal and a little pearl shimmer.'},
  {id:'autumn-cottage', name:'Autumn Cottage', description:'Warm linen, terracotta, olive leaves and copper gold.'},
];
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
  const background = getComputedStyle(root).getPropertyValue('--compact-bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  button.setAttribute('aria-label', `Themes: ${theme.name}`);
  for (const choice of backdrop.querySelectorAll('[data-theme-choice]')) {
    const active = choice.dataset.themeChoice === theme.id;
    choice.setAttribute('aria-checked', String(active));
    choice.tabIndex = active ? 0 : -1;
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
function choose(choice) {
  const theme = THEMES.find(item => item.id === choice.dataset.themeChoice);
  if (!theme) return;
  apply(theme);
  try {
    localStorage.setItem(KEY, theme.id);
    status.textContent = `${theme.name} is selected and remembered on this device.`;
  } catch {
    status.textContent = `${theme.name} is selected for this visit. This browser couldn't remember the choice.`;
  }
}
const cards = [...backdrop.querySelectorAll('[data-theme-choice]')];
for (const choice of cards) {
  choice.addEventListener('click', () => choose(choice));
  // A radio group has one Tab stop. Arrow keys move between looks; touch/Pencil just tap.
  choice.addEventListener('keydown', event => {
    const direction = {ArrowRight:1, ArrowDown:1, ArrowLeft:-1, ArrowUp:-1}[event.key];
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 :
      (cards.indexOf(choice) + direction + cards.length) % cards.length;
    choose(cards[index]); cards[index].focus();
  });
}
apply(selected);
