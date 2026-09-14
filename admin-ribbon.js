const VIEWS = [
  { key:'setup', label:'Setup', icon:'⌁', get:()=>document.querySelector('#tournament-generator') },
  { key:'live', label:'Live Control', icon:'●', get:()=>document.querySelector('#live-control') },
  { key:'teams', label:'Pasukan & Manual', icon:'◆', get:()=>document.querySelector('#team-form')?.closest('section') },
  { key:'roster', label:'Roster', icon:'♟', get:()=>document.querySelector('#player-form')?.closest('section') },
  { key:'matches', label:'Perlawanan', icon:'≡', get:()=>document.querySelector('#match-table')?.closest('section') },
  { key:'operations', label:'Operasi', icon:'⚡', get:()=>document.querySelector('#event-operations') },
  { key:'marshal', label:'Marshal', icon:'♜', get:()=>document.querySelector('#marshal-management') },
  { key:'settings', label:'Tetapan', icon:'⚙', get:()=>document.querySelector('#tournament-form')?.closest('section') }
];

const STORE_KEY='esports-admin-ribbon-view';
let activeKey='';
let installed=false;
let syncTimer=null;

function css(){
  if(document.querySelector('#admin-ribbon-style'))return;
  const s=document.createElement('style');
  s.id='admin-ribbon-style';
  s.textContent=`
    body.admin-ribbon-mode .hero{margin-top:14px;padding:16px 20px;border-radius:18px}
    body.admin-ribbon-mode .hero h1{font-size:clamp(1.65rem,3vw,2.65rem);margin:.15rem 0 .25rem}
    body.admin-ribbon-mode .hero p{margin:.25rem 0 0}
    body.admin-ribbon-mode .admin-filter-source{display:none!important}
    .admin-ribbon-shell{position:sticky;top:86px;z-index:19;margin-top:14px;border:1px solid var(--line);border-radius:16px;background:rgba(6,12,30,.94);box-shadow:var(--shadow-cyan);backdrop-filter:blur(16px);padding:9px;display:flex;align-items:center;gap:10px}
    .admin-ribbon-tabs{display:flex;gap:7px;align-items:center;min-width:0;overflow-x:auto;scrollbar-width:none;flex:1}
    .admin-ribbon-tabs::-webkit-scrollbar{display:none}
    .admin-ribbon-tab,.admin-menu-toggle,.admin-ribbon-close{white-space:nowrap;border:1px solid rgba(255,255,255,.10);border-radius:11px;background:rgba(255,255,255,.035);color:var(--muted);padding:9px 12px;font-weight:850;letter-spacing:.02em}
    .admin-ribbon-tab:hover,.admin-menu-toggle:hover,.admin-ribbon-close:hover{border-color:var(--cyan);color:var(--text)}
    .admin-ribbon-tab.active{border-color:rgba(64,230,255,.55);color:#fff;background:linear-gradient(135deg,rgba(0,174,251,.25),rgba(137,92,255,.14));box-shadow:0 0 18px rgba(64,230,255,.13)}
    .admin-ribbon-filter{display:flex;align-items:center;gap:7px;flex:0 0 auto}
    .admin-ribbon-filter span{font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:800}
    .admin-ribbon-filter select{width:auto;min-width:145px;padding:8px 10px}
    .admin-menu-toggle{display:none;color:var(--text)}
    .admin-ribbon-current{display:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:900;color:var(--cyan)}
    [data-admin-view-panel][hidden]{display:none!important}
    [data-admin-view-panel]:not([hidden]){animation:adminPanelIn .18s ease-out}
    @keyframes adminPanelIn{from{opacity:.2;transform:translateY(7px)}to{opacity:1;transform:none}}
    .admin-panel-empty{display:none;margin-top:18px;border:1px dashed rgba(64,230,255,.28);border-radius:16px;padding:28px;text-align:center;color:var(--muted);background:rgba(6,12,30,.55)}
    .admin-panel-empty.show{display:block}
    .admin-menu-backdrop{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.68);display:none;align-items:flex-end;justify-content:center;padding:14px}
    .admin-menu-backdrop.open{display:flex}
    .admin-menu-sheet{width:min(560px,100%);max-height:82vh;overflow:auto;border:1px solid var(--line);border-radius:20px;background:#081126;box-shadow:0 -18px 70px rgba(0,0,0,.45);padding:16px}
    .admin-menu-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .admin-menu-sheet h3{margin:0;text-transform:uppercase;letter-spacing:.08em}
    .admin-menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .admin-menu-item{border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(255,255,255,.035);color:var(--text);padding:14px;text-align:left;font-weight:850}
    .admin-menu-item.active{border-color:var(--cyan);background:rgba(64,230,255,.10)}
    .admin-menu-item small{display:block;color:var(--muted);font-weight:600;margin-top:3px}
    @media(max-width:820px){
      body.admin-ribbon-mode .topbar{position:relative;top:auto}
      body.admin-ribbon-mode .hero{padding:13px 15px}
      body.admin-ribbon-mode .hero .eyebrow,body.admin-ribbon-mode .hero p{font-size:.76rem}
      .admin-ribbon-shell{top:8px;padding:8px}
      .admin-ribbon-tabs{display:none}
      .admin-menu-toggle,.admin-ribbon-current{display:block}
      .admin-ribbon-current{flex:1}
      .admin-ribbon-filter span{display:none}
      .admin-ribbon-filter select{min-width:112px;max-width:38vw}
      .admin-ribbon-close{padding:9px 10px}
    }
    @media(max-width:520px){
      .admin-ribbon-filter{display:none}
      .admin-menu-grid{grid-template-columns:1fr}
      .admin-menu-backdrop{padding:8px}
      .admin-menu-sheet{border-radius:18px 18px 10px 10px}
    }
  `;
  document.head.appendChild(s);
}

function viewByKey(key){return VIEWS.find(v=>v.key===key)}
function target(v){try{return v?.get?.()||null}catch{return null}}
function isAvailable(v){
  const el=target(v);if(!el)return false;
  if((v.key==='marshal'||v.key==='operations')&&el.classList.contains('hidden'))return false;
  return true;
}
function allTargets(){return VIEWS.map(v=>[v,target(v)]).filter(([,el])=>el)}

function ensureRibbon(){
  let shell=document.querySelector('#admin-ribbon');if(shell)return shell;
  const admin=document.querySelector('#admin-view');if(!admin)return null;
  document.body.classList.add('admin-ribbon-mode');
  const hero=admin.querySelector('.hero');
  shell=document.createElement('div');shell.id='admin-ribbon';shell.className='admin-ribbon-shell';
  shell.innerHTML=`<button type="button" class="admin-menu-toggle" id="admin-menu-toggle">☰ Menu</button><div class="admin-ribbon-current" id="admin-ribbon-current">Control Room</div><div class="admin-ribbon-tabs" id="admin-ribbon-tabs"></div><div class="admin-ribbon-filter"><span>Game</span><div id="admin-ribbon-filter-slot"></div></div><button type="button" class="admin-ribbon-close" id="admin-ribbon-close" title="Tutup panel semasa">×</button>`;
  hero?.insertAdjacentElement('afterend',shell);
  const filter=document.querySelector('#admin-game-filter');
  if(filter){const source=filter.closest('section');source?.classList.add('admin-filter-source');document.querySelector('#admin-ribbon-filter-slot')?.appendChild(filter)}
  const empty=document.createElement('div');empty.id='admin-panel-empty';empty.className='admin-panel-empty';empty.innerHTML='<strong>Panel ditutup.</strong><div style="margin-top:5px">Pilih menu pada ribbon untuk buka semula.</div>';shell.insertAdjacentElement('afterend',empty);
  const backdrop=document.createElement('div');backdrop.id='admin-menu-backdrop';backdrop.className='admin-menu-backdrop';backdrop.innerHTML=`<div class="admin-menu-sheet" role="dialog" aria-modal="true" aria-label="Menu Control Room"><div class="admin-menu-sheet-head"><div><div class="eyebrow">Control Room</div><h3>Pilih Menu</h3></div><button type="button" class="btn" id="admin-menu-dismiss">Tutup</button></div><div class="admin-menu-grid" id="admin-menu-grid"></div></div>`;document.body.appendChild(backdrop);
  return shell;
}

function renderButtons(){
  const tabs=document.querySelector('#admin-ribbon-tabs'),grid=document.querySelector('#admin-menu-grid');if(!tabs||!grid)return;
  const available=VIEWS.filter(isAvailable);
  tabs.innerHTML=available.map(v=>`<button type="button" class="admin-ribbon-tab${activeKey===v.key?' active':''}" data-admin-view="${v.key}">${v.icon} ${v.label}</button>`).join('');
  grid.innerHTML=available.map(v=>`<button type="button" class="admin-menu-item${activeKey===v.key?' active':''}" data-admin-view="${v.key}"><span>${v.icon} ${v.label}</span><small>${v.key==='live'?'Kawal skor dan status LIVE':v.key==='setup'?'Generate jadual dan bracket':v.key==='teams'?'Pasukan dan match manual':v.key==='operations'?'Delay jadual dan reset':v.key==='marshal'?'Urus akaun marshal':v.key==='matches'?'Senarai semua match':v.key==='roster'?'Senarai pemain':'Nama dan identiti kejohanan'}</small></button>`).join('');
}

function applyVisibility(){
  const pairs=allTargets();
  for(const [v,el] of pairs){el.dataset.adminViewPanel='1';el.hidden=!activeKey||v.key!==activeKey}
  const empty=document.querySelector('#admin-panel-empty');empty?.classList.toggle('show',!activeKey);
  const label=document.querySelector('#admin-ribbon-current');const v=viewByKey(activeKey);if(label)label.textContent=v?`${v.icon} ${v.label}`:'Control Room';
  renderButtons();
}

function choose(key,{scroll=true}={}){
  const v=viewByKey(key);if(!v||!isAvailable(v))return false;
  activeKey=key;try{localStorage.setItem(STORE_KEY,key)}catch{}
  applyVisibility();closeMenu();
  if(scroll)document.querySelector('#admin-ribbon')?.scrollIntoView({behavior:'smooth',block:'start'});
  return true;
}
function closeCurrent(){activeKey='';applyVisibility()}
function openMenu(){document.querySelector('#admin-menu-backdrop')?.classList.add('open')}
function closeMenu(){document.querySelector('#admin-menu-backdrop')?.classList.remove('open')}

function sync(){
  ensureRibbon();
  let saved='';try{saved=localStorage.getItem(STORE_KEY)||''}catch{}
  if(activeKey&&!isAvailable(viewByKey(activeKey)))activeKey='';
  if(!activeKey){
    const preferred=(saved&&isAvailable(viewByKey(saved)))?saved:(isAvailable(viewByKey('live'))?'live':'setup');
    const pv=viewByKey(preferred);if(pv&&isAvailable(pv))activeKey=preferred;
  }
  applyVisibility();
}
function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(sync,80)}

function bind(){
  if(installed)return;installed=true;css();ensureRibbon();
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-admin-view]');if(nav){choose(nav.dataset.adminView);return}
    if(e.target.closest('#admin-menu-toggle')){openMenu();return}
    if(e.target.closest('#admin-menu-dismiss')){closeMenu();return}
    if(e.target.closest('#admin-ribbon-close')){closeCurrent();return}
    if(e.target.id==='admin-menu-backdrop')closeMenu();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  const admin=document.querySelector('#admin-view');if(admin)new MutationObserver(scheduleSync).observe(admin,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  sync();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
