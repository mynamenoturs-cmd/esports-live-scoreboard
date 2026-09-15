const tabs=[
  {key:'standings',label:'Kedudukan'},
  {key:'statistics',label:'Statistik'},
  {key:'schedule',label:'Jadual'},
  {key:'teams',label:'Pasukan'}
];
const STORE='esports-dashboard-view';
let current='standings';
try{current=localStorage.getItem(STORE)||'standings'}catch{}

function setPanel(key){
  if(!tabs.some(t=>t.key===key))key='standings';
  current=key;try{localStorage.setItem(STORE,key)}catch{}
  document.querySelectorAll('[data-dashboard-panel]').forEach(el=>{el.hidden=el.dataset.dashboardPanel!==key});
  document.querySelectorAll('[data-dashboard-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.dashboardView===key));
}
function openMenu(){document.querySelector('#dashboard-mobile-menu')?.classList.add('open')}
function closeMenu(){document.querySelector('#dashboard-mobile-menu')?.classList.remove('open')}

function boot(){
  setPanel(current);
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-dashboard-view]');if(tab){setPanel(tab.dataset.dashboardView);return}
    if(e.target.closest('#dashboard-menu-toggle')){openMenu();return}
    if(e.target.closest('#dashboard-menu-close')){closeMenu();return}
    if(e.target.id==='dashboard-mobile-menu'){closeMenu();return}
    if(e.target.closest('#dashboard-mobile-menu a'))closeMenu();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();