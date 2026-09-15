const $=s=>document.querySelector(s);

function status(){return String($('#control-status')?.textContent||'').trim().toUpperCase()}
function show(text){
  const el=$('#admin-message');if(!el)return;
  el.textContent=text;el.className='notice error section';el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),6000);
}
function ensureLock(panel){
  let lock=panel.querySelector('.mlbb-live-lock');
  if(!lock){
    lock=document.createElement('div');lock.className='mlbb-live-lock notice';
    panel.prepend(lock);
  }
  return lock;
}
function apply(){
  const panel=$('#mlbb-series-control');if(!panel)return;
  const s=status(),live=s==='LIVE';
  const lock=ensureLock(panel);
  if(live){lock.hidden=true;panel.classList.remove('is-locked')}
  else{
    lock.hidden=false;panel.classList.add('is-locked');
    lock.innerHTML=s==='PAUSED'
      ? '<strong>STATISTIK DIKUNCI</strong><br>Perlawanan sedang Pause. Tekan START LIVE semula untuk merekod Kill, MVP dan KDA.'
      : s==='FINISHED'
        ? '<strong>STATISTIK RASMI DIKUNCI</strong><br>Perlawanan telah tamat. Tiada statistik game baharu boleh direkod.'
        : '<strong>TEKAN ● START LIVE DAHULU</strong><br>Kill, MVP, KDA dan pemenang game hanya boleh direkod selepas perlawanan berstatus LIVE.';
  }
  panel.querySelectorAll('#mlbb-kill-a,#mlbb-kill-b,#mlbb-mvp-name,#mlbb-mvp-k,#mlbb-mvp-d,#mlbb-mvp-a,[data-mlbb-win]').forEach(el=>{el.disabled=!live;el.setAttribute('aria-disabled',String(!live))});
}
function boot(){
  apply();
  const observer=new MutationObserver(()=>{clearTimeout(boot.t);boot.t=setTimeout(apply,30)});
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',e=>{
    const win=e.target.closest('[data-mlbb-win]');
    if(win&&status()!=='LIVE'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      show('Tekan START LIVE dahulu. Kill, MVP, KDA dan keputusan game hanya boleh direkod semasa perlawanan LIVE.');
    }
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
