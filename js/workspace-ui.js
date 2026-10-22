// Compact interface only. Drawing stays in editor.js and its original engines.
import { openModal, closeModal, modalIsOpen } from './modal.js?v=20261022001928';
import { setupPageBrowser } from './page-browser.js?v=20261022001928';
import { currentColor, onPaletteChange, activePalette, recentColors } from './palette.js?v=20261022001928';

export function setupWorkspace({currentPage, prepareChange, busy, preview, fit}) {
  const get=id=>document.getElementById(id), screen=get('coloring-screen');
  const pairs=[['brush-options-button','brush-options'],['colors-button','quick-colors'],['editor-options-button','editor-options'],['pages-button','pages-drawer']];
  let focused=false;
  const browser=setupPageBrowser({currentPage,prepareChange,close:()=>close('pages-drawer')});
  function close(id){
    if(id==='pages-drawer')browser.cancel();
    closeModal(get(id));get(pairs.find(pair=>pair[1]===id)[0]).setAttribute('aria-expanded','false');
  }
  for(const [button,id] of pairs){
    get(button).addEventListener('click',()=>{
      if(busy())return; // Never move controls or switch pages during a captured stroke.
      openModal(get(id),{onClose:()=>close(id),initialFocus:get(id).querySelector('button'),returnFocus:get(button)});
      get(button).setAttribute('aria-expanded','true');
      if(id==='brush-options')preview();
      if(id==='pages-drawer')browser.begin();
    });
    get(id).addEventListener('click',event=>{if(event.target===get(id))close(id);});
    for(const button of get(id).querySelectorAll('[data-close-compact]'))button.addEventListener('click',()=>close(id));
  }
  get('pages-close').addEventListener('click',()=>close('pages-drawer'));
  function showColor(){
    get('colors-button').style.setProperty('--current',currentColor());
    get('colors-button').setAttribute('aria-label',`Colors: ${currentColor()}`);
    get('quick-palette-title').textContent=activePalette().name;
    get('quick-recent-title').hidden=!recentColors().length;
  }
  onPaletteChange(showColor);showColor();
  function focus(on){
    if(busy())return;
    if(!get('editor-options').hidden)close('editor-options');
    focused=on;screen.classList.toggle('focus-picture',on);get('exit-focus').hidden=!on;
    requestAnimationFrame(()=>{fit();(on?get('exit-focus'):get('pages-button')).focus({preventScroll:true});});
  }
  get('focus-picture').addEventListener('click',()=>focus(true));get('exit-focus').addEventListener('click',()=>focus(false));
  get('fit-picture').addEventListener('click',()=>{if(!busy())fit();});
  window.addEventListener('keydown',event=>{
    if(screen.hidden||modalIsOpen()||event.ctrlKey||event.metaKey||event.altKey||event.repeat||event.target.closest?.('input,textarea,[contenteditable]'))return;
    if(event.key==='Escape'&&focused){event.preventDefault();focus(false);}
    else if(event.key.toLowerCase()==='f'){event.preventDefault();focus(!focused);}
  });
  window.addEventListener('hashchange',()=>{if(screen.hidden){focused=false;screen.classList.remove('focus-picture');get('exit-focus').hidden=true;}});
}
