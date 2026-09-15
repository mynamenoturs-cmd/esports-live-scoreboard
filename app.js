import './series-style-loader.js?v=series3';
import './mlbb-result-public.js?v=series3';
import { loadTournamentBundle, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation, gameUrl } from './data.js';
import { liveMatchHtml, standingsHtml, scheduleHtml, teamsHtml, nextMatchHtml, gameTabsHtml, formatSummaryText } from './ui.js?v=series3';

let sub,root,selectedCode;
function view(){ return filterBundle(root,selectedCode); }
function setRouteLinks(route,href){document.querySelectorAll(`[data-route="${route}"]`).forEach(a=>a.href=href)}
function setText(sel,text){const el=document.querySelector(sel);if(el)el.textContent=text}
function paintHeader(b){
  const stations=[...new Set((b.matches||[]).map(m=>String(m.station||'1')))];
  const liveMatches=(b.matches||[]).filter(m=>m.status==='live');
  const liveStations=[...new Set(liveMatches.map(m=>String(m.station||'1')))].sort((a,b)=>Number(a)-Number(b));
  setText('#header-event',[root.tournament.name,root.tournament.venue].filter(Boolean).join(' · '));
  setText('#header-game',b.activeGame.code?.toUpperCase()||'GAME');
  setText('#header-stations',`${Math.max(stations.length,1)} STATION${stations.length>1?'S':''}`);
  setText('#header-live',liveStations.length?liveStations.map(s=>`S${s} LIVE`).join(' · '):'READY');
  const liveChip=document.querySelector('#header-live-chip');
  if(liveChip)liveChip.classList.toggle('is-live',liveStations.length>0);
}
function paint(){
  const b=view(); if(!b.activeGame) return;
  selectedCode=b.activeGame.code;
  document.querySelector('#tournament-name').textContent=root.tournament.name;
  document.querySelector('#tournament-meta').textContent=[root.tournament.venue,b.activeGame.name,root.demo?'DEMO MODE':'REALTIME'].filter(Boolean).join(' · ');
  document.querySelector('#game-tabs').innerHTML=gameTabsHtml(root,selectedCode);
  document.querySelector('#live-panel').innerHTML=liveMatchHtml(b);
  document.querySelector('#standings').innerHTML=standingsHtml(b);
  document.querySelector('#schedule').innerHTML=scheduleHtml(b);
  document.querySelector('#teams').innerHTML=teamsHtml(b);
  document.querySelector('#next-match').innerHTML=nextMatchHtml(b);
  const summary=document.querySelector('#format-summary');if(summary)summary.textContent=formatSummaryText(b);
  document.querySelector('#demo-notice').classList.toggle('hidden',!root.demo);
  setRouteLinks('live',gameUrl('./live',b.activeGame));
  setRouteLinks('bracket',gameUrl('./bracket',b.activeGame));
  setRouteLinks('overlay',gameUrl('./overlay',b.activeGame));
  paintHeader(b);
  document.querySelector('#app').classList.remove('hidden');
}
function selectGame(code){selectedCode=code;const u=new URL(location.href);u.searchParams.set('game',code);history.replaceState({},'',u);paint()}
async function boot(){
  try{
    root=await loadTournamentBundle(); selectedCode=gameFromLocation(root)?.code; paint();
    if(!root.demo&&!sub) sub=subscribeTournament(root.tournament.id,payload=>{applyRealtimeChange(root,payload);paint()});
  }catch(e){document.querySelector('#fatal').textContent=e.message;document.querySelector('#fatal').classList.remove('hidden')}
}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-game]');if(btn)selectGame(btn.dataset.game)});
boot();
