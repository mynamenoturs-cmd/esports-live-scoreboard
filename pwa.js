let deferredInstall=null;
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||window.navigator.standalone===true;
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

function ensureInstallUI(){
  if(isStandalone())return;
  const mobile=document.querySelector('.dashboard-mobile-grid');
  if(mobile&&!document.querySelector('#install-app-mobile')){
    const b=document.createElement('button');b.type='button';b.id='install-app-mobile';b.className='pwa-install-card';b.innerHTML='<span>Install App</span><small>Pasang PesMAC Live pada telefon</small>';mobile.appendChild(b);
  }
  const nav=document.querySelector('.dashboard-nav');
  if(nav&&!document.querySelector('#install-app-nav')){
    const b=document.createElement('button');b.type='button';b.id='install-app-nav';b.className='pwa-install-nav';b.textContent='Install';nav.appendChild(b);
  }
  if(!document.querySelector('#pwa-install-help')){
    const box=document.createElement('div');box.id='pwa-install-help';box.className='pwa-install-help';box.innerHTML=`<div class="pwa-install-dialog" role="dialog" aria-modal="true"><div class="pwa-install-head"><div><div class="eyebrow">PesMAC 4.0</div><h3>Install App</h3></div><button type="button" class="btn" id="pwa-install-close">Tutup</button></div><div id="pwa-install-copy" class="pwa-install-copy"></div></div>`;document.body.appendChild(box);
  }
}
function showHelp(){
  ensureInstallUI();const box=document.querySelector('#pwa-install-help'),copy=document.querySelector('#pwa-install-copy');if(!box||!copy)return;
  if(isIOS())copy.innerHTML='<strong>iPhone / iPad</strong><p>Buka laman ini dalam Safari, tekan butang <b>Share</b>, pilih <b>Add to Home Screen</b>, kemudian tekan <b>Add</b>. Ikon PesMAC akan muncul seperti aplikasi biasa.</p>';
  else copy.innerHTML='<strong>Install pada telefon</strong><p>Buka menu browser dan pilih <b>Install app</b> atau <b>Add to Home screen</b>. Selepas dipasang, PesMAC Live akan dibuka dalam paparan aplikasi standalone.</p>';
  box.classList.add('open');
}
function closeHelp(){document.querySelector('#pwa-install-help')?.classList.remove('open')}
async function install(){
  if(isStandalone())return;
  if(deferredInstall){
    deferredInstall.prompt();
    try{await deferredInstall.userChoice}catch{}
    deferredInstall=null;
    return;
  }
  showHelp();
}
function hideInstallButtons(){document.querySelector('#install-app-mobile')?.remove();document.querySelector('#install-app-nav')?.remove();closeHelp()}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;ensureInstallUI()});
window.addEventListener('appinstalled',hideInstallButtons);
document.addEventListener('click',event=>{
  if(event.target.closest('#install-app-mobile,#install-app-nav')){install();return}
  if(event.target.closest('#pwa-install-close')){closeHelp();return}
  if(event.target.id==='pwa-install-help')closeHelp();
});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureInstallUI,{once:true});else ensureInstallUI();
