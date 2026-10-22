// The editor's Pages drawer. Browse with small thumbnails; only opening a page loads its art.
import { categories } from './library.js?v=20261022003833';
import { getProgressTimes, getPreviewURL, previewsReady } from './autosave.js?v=20261022003833';
import { getThumbnailURL } from './thumbnails.js?v=20261022003833';

export function setupPageBrowser({currentPage, prepareChange, close}) {
  const get=id=>document.getElementById(id), content=get('pages-content'), search=get('pages-search');
  const all=categories.flatMap(cat=>cat.subcategories.flatMap(sub=>sub.pages));
  let category=null, subcategory=null, times=new Map(), generation=0, observer=null, changing=false;
  const status=get('pages-status');
  const up=get('pages-up');
  async function begin() {
    const page=currentPage(); category=page?.subcategory.category; subcategory=page?.subcategory;
    search.value='';content.replaceChildren();status.textContent='Saving and loading pages…';
    const round=++generation;observer?.disconnect();changing=true;search.disabled=up.disabled=true;
    try {
      if (!await prepareChange()) throw new Error('Your coloring is not saved yet. Keep this page open and try again.');
      await previewsReady(); const progress=await getProgressTimes();
      if(round!==generation)return;
      times=progress;status.textContent='';changing=false;search.disabled=up.disabled=false;render();
    } catch(error) {if(round===generation){status.textContent=error.message;changing=false;}}
  }
  function cancel(){generation++;observer?.disconnect();}
  function group(name,count,choose){
    const button=document.createElement('button');button.type='button';button.className='pages-group';
    const copy=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');
    title.textContent=name;detail.textContent=`${count} ${count===1?'page':'pages'}`;copy.append(title,detail);
    const arrow=document.createElement('span');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');
    button.append(copy,arrow);button.addEventListener('click',choose);return button;
  }
  function render(){
    const round=++generation;observer?.disconnect();content.replaceChildren();content.scrollTop=0;
    const query=search.value.trim().toLocaleLowerCase();
    get('pages-count').textContent=`${all.length} pages`;
    up.hidden=!query&&!category;up.textContent='‹ '+(query?'All collections':subcategory?category.name:'All collections');
    get('pages-location').textContent=query?'Search':subcategory?.name||category?.name||'Collections';
    if(!query&&!subcategory){
      content.classList.remove('pages-grid');
      for(const item of category?category.subcategories:categories)content.append(group(item.name,item.pages?.length??item.pageCount,()=>{
        if(category)subcategory=item;else category=item;render();
      }));return;
    }
    content.classList.add('pages-grid');
    const list=query?all.filter(page=>`${page.title} ${page.subcategory.name} ${page.subcategory.category.name}`.toLocaleLowerCase().includes(query)):subcategory.pages;
    status.textContent=list.length?'':'No pages match this search.';
    observer=new IntersectionObserver(entries=>{
      for(const entry of entries){if(!entry.isIntersecting||round!==generation)continue;observer.unobserve(entry.target);loadThumb(entry.target,round);}
    },{root:content,rootMargin:'200px 0px'});
    for(const page of list){
      const card=document.createElement('button');card.type='button';card.className='drawer-page';card.dataset.page=page.id;
      if(currentPage()?.id===page.id)card.setAttribute('aria-current','page');
      const img=document.createElement('img');img.alt='';img.width=126;img.height=168;img.loading='lazy';
      const name=document.createElement('strong');name.textContent=page.title;
      const detail=document.createElement('small');detail.textContent=times.has(page.id)?'In progress':'Ready to color';
      card.append(img,name,detail);
      card.addEventListener('click',async()=>{
        if(changing)return;
        if(currentPage()?.id===page.id){close();return;}
        changing=true;content.setAttribute('aria-busy','true');status.textContent='Saving your coloring…';
        try {
          if(!await prepareChange())throw new Error('Your coloring has not finished saving. Please try again.');
          // Closing the window during a save cancels that choice without discarding the save.
          if(round!==generation)return;
          close();location.hash=`#/page/${encodeURIComponent(page.id)}`;
        } catch(error){if(round===generation)status.textContent=error.message;}
        finally{changing=false;content.removeAttribute('aria-busy');}
      });
      content.append(card);observer.observe(card);
    }
    async function loadThumb(card,expected){
      const page=all.find(p=>p.id===card.dataset.page),img=card.querySelector('img');
      const live=()=>expected===generation&&card.isConnected;
      const blank=async()=>page.thumb||await getThumbnailURL(page.file);
      try {
        const src=times.has(page.id)?await getPreviewURL(page.id):null;
        if(!live())return;
        img.onerror=async()=>{
          img.onerror=null;
          try{
            const src=await blank();if(!live())return;
            if(img.src===new URL(src,document.baseURI).href){img.alt=`Preview unavailable: ${page.title}`;return;}
            img.onerror=()=>{img.onerror=null;if(live())img.alt=`Preview unavailable: ${page.title}`;};
            img.src=src;
          }catch{if(live())img.alt=`Preview unavailable: ${page.title}`;}
        };
        const url=src||await blank();if(live())img.src=url;
      }catch{if(live())img.alt=`Preview unavailable: ${page.title}`;}
    }
  }
  up.addEventListener('click',()=>{if(changing)return;status.textContent='';if(search.value){search.value='';category=subcategory=null;}else if(subcategory)subcategory=null;else category=null;render();});
  search.addEventListener('input',()=>{if(!changing)render();});
  return {begin,cancel};
}
