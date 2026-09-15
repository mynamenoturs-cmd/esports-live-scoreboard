const $=s=>document.querySelector(s);

function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function hideFieldFor(id){
  const el=$(id);if(!el)return;
  const field=el.closest('.field');if(field)field.style.display='none';
}
function apply(){
  const view=$('#admin-view');if(!view)return;

  const hero=view.querySelector('.hero');
  if(hero){
    setText(hero.querySelector('.eyebrow'),'Tournament Operations · MLBB');
    setText(hero.querySelector('h1'),'MLBB Control Room');
    setText(hero.querySelector('p'),'Kawal pasukan, station, siri Best Of, keputusan game, MVP dan live broadcast Mobile Legends: Bang Bang.');
  }

  const filter=$('#admin-game-filter');
  if(filter){
    const mlbb=[...filter.options].find(o=>String(o.value).toLowerCase()==='mlbb');
    if(mlbb){filter.value='mlbb';filter.dispatchEvent(new Event('change',{bubbles:true}))}
    const panel=filter.closest('.panel');if(panel)panel.style.display='none';
  }

  for(const id of ['#team-game','#match-game','#generator-game']){
    const el=$(id);if(!el)continue;
    const mlbb=[...el.options].find(o=>/MLBB/i.test(o.textContent)||String(o.dataset?.code||'').toLowerCase()==='mlbb');
    if(mlbb&&el.value!==mlbb.value){el.value=mlbb.value;el.dispatchEvent(new Event('change',{bubbles:true}))}
    hideFieldFor(id);
  }

  const generator=$('#tournament-generator');
  const note=generator?.querySelector('#generator-goals-note');if(note)note.remove();

  document.querySelectorAll('body *').forEach(el=>{
    if(el.children.length)return;
    const t=(el.textContent||'').trim();
    if(t==='Multi Game')el.textContent='MLBB';
    if(t==='Admin & Referee')el.textContent='MLBB Admin & Marshal';
  });
}

function boot(){
  apply();
  const root=document.body;
  const obs=new MutationObserver(()=>{clearTimeout(boot.t);boot.t=setTimeout(apply,60)});
  obs.observe(root,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
