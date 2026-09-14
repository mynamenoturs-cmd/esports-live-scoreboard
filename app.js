import { loadTournamentBundle, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation, gameUrl } from './data.js';
import { liveMatchHtml, standingsHtml, scheduleHtml, teamsHtml, nextMatchHtml, gameTabsHtml, formatSummaryText } from './ui.js';

let sub,root,selectedCode;
function view(){ return filterBundle(root,selectedCode); }
function setRouteLinks(route,href){document.querySelectorAll(`[data-route="${route}"]`).forEach(a=>a.href=href)}
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
