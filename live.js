import { loadTournamentBundle, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation } from './data.js';
import { liveMatchHtml, nextMatchHtml, gameTabsHtml } from './ui.js';
let sub,root,selectedCode;
const selectedStation=()=>{try{return new URLSearchParams(location.search).get('station')||''}catch{return ''}};
function stationBundle(bundle,station){return station?{...bundle,matches:bundle.matches.filter(m=>String(m.station||'1')===String(station))}:bundle}
function liveHtml(bundle){
  const station=selectedStation();
  const b=stationBundle(bundle,station);
  if(station)return `<div class="kicker" style="margin-bottom:12px">STATION ${station}</div>${liveMatchHtml(b)}`;
  const lives=b.matches.filter(m=>m.status==='live');
  if(lives.length<=1)return liveMatchHtml(b);
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(620px,100%),1fr));gap:18px">${lives.map(m=>`<div><div class="kicker" style="margin-bottom:10px">STATION ${m.station||'1'}</div>${liveMatchHtml({...b,matches:[m]})}</div>`).join('')}</div>`;
}
function paint(){
  const raw=filterBundle(root,selectedCode);if(!raw.activeGame)return;
  selectedCode=raw.activeGame.code;
  const station=selectedStation();
  document.querySelector('#title').textContent=`${root.tournament.name} · ${raw.activeGame.name}${station?` · Station ${station}`:''}`;
  document.querySelector('#game-tabs').innerHTML=gameTabsHtml(root,selectedCode);
  document.querySelector('#live').innerHTML=liveHtml(raw);
  document.querySelector('#next').innerHTML=nextMatchHtml(stationBundle(raw,station));
}
function selectGame(code){selectedCode=code;const u=new URL(location.href);u.searchParams.set('game',code);history.replaceState({},'',u);paint()}
async function boot(){try{root=await loadTournamentBundle();selectedCode=gameFromLocation(root)?.code;paint();if(!root.demo&&!sub)sub=subscribeTournament(root.tournament.id,p=>{applyRealtimeChange(root,p);paint()})}catch(e){document.querySelector('#live').innerHTML=`<div class="notice error">${e.message}</div>`}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(b)selectGame(b.dataset.game)});
boot();
