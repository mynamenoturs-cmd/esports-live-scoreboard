import './series-style-loader.js?v=series4';
import './mlbb-result-public.js?v=winner2';
import { loadTournamentBundle, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation } from './data.js';
import { liveMatchHtml, nextMatchHtml, gameTabsHtml } from './ui.js?v=series4';
let sub,root,selectedCode,countdownTimer,winnerActive=false;
const winnerQueue=[];
const shownWinners=new Set();
const selectedStation=()=>{try{return new URLSearchParams(location.search).get('station')||''}catch{return ''}};
const esc=(s='')=>String(s).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const initials=(name='TEAM')=>String(name).trim().split(/\s+/).map(x=>x[0]||'').join('').slice(0,3).toUpperCase()||'TM';
function stationBundle(bundle,station){return station?{...bundle,matches:bundle.matches.filter(m=>String(m.station||'1')===String(station))}:bundle}
function liveHtml(bundle){
  const station=selectedStation();
  const b=stationBundle(bundle,station);
  if(station)return `<div class="kicker" style="margin-bottom:12px">STATION ${station}</div>${liveMatchHtml(b)}`;
  const lives=b.matches.filter(m=>m.status==='live');
  if(lives.length<=1)return liveMatchHtml(b);
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(620px,100%),1fr));gap:18px">${lives.map(m=>`<div><div class="kicker" style="margin-bottom:10px">STATION ${m.station||'1'}</div>${liveMatchHtml({...b,matches:[m]})}</div>`).join('')}</div>`;
}
function nextPerStation(bundle){
  const station=selectedStation();
  const matches=station?bundle.matches.filter(m=>String(m.station||'1')===String(station)):bundle.matches;
  const scheduled=matches.filter(m=>m.status==='scheduled'&&m.scheduled_at).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
  const seen=new Set(),out=[];
  for(const m of scheduled){const s=String(m.station||'1');if(seen.has(s))continue;seen.add(s);out.push(m)}
  return out.sort((a,b)=>Number(a.station||1)-Number(b.station||1));
}
function countdownHtml(bundle){
  const rows=nextPerStation(bundle);
  if(!rows.length)return '';
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:12px">${rows.map(m=>`<div class="notice" style="margin:0;text-align:center"><div class="kicker">STATION ${m.station||'1'} · NEXT MATCH</div><div data-countdown-at="${m.scheduled_at}" style="font-size:clamp(1.1rem,3vw,1.8rem);font-weight:900;margin-top:4px">—</div></div>`).join('')}</div>`;
}
function formatCountdown(iso){
  const t=new Date(iso).getTime();if(!Number.isFinite(t))return 'MASA BELUM DITETAPKAN';
  const diff=t-Date.now();if(diff<=0)return 'SEDIA DIMULAKAN';
  const total=Math.floor(diff/1000),days=Math.floor(total/86400),hours=Math.floor((total%86400)/3600),mins=Math.floor((total%3600)/60),secs=total%60;
  const clock=[hours,mins,secs].map(n=>String(n).padStart(2,'0')).join(':');
  return days>0?`MULA DALAM ${days}H ${clock}`:`MULA DALAM ${clock}`;
}
function tickCountdowns(){document.querySelectorAll('[data-countdown-at]').forEach(el=>{el.textContent=formatCountdown(el.dataset.countdownAt)})}

function safeLogo(value){
  const raw=String(value||'').trim();if(!raw)return '';
  try{const u=new URL(raw,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}
}
function winnerLogoHtml(team){
  const src=safeLogo(team?.logo_url),fallback=esc(team?.short_name||initials(team?.name));
  return `<div class="winner-team-logo">${src?`<img src="${esc(src)}" alt="${esc(team?.name||'Pemenang')}" onerror="this.remove();this.parentElement.insertAdjacentHTML('beforeend','<span>${fallback}</span>')">`:`<span>${fallback}</span>`}</div>`;
}
function seriesDots(wins,target){
  return `<div class="winner-series" aria-label="${wins} daripada ${target} kemenangan game">${Array.from({length:target},(_,i)=>`<span class="winner-series-dot ${i<Number(wins||0)?'on':''}"></span>`).join('')}</div>`;
}
function ensureWinnerSplash(){
  let el=document.querySelector('#winner-splash');if(el)return el;
  el=document.createElement('div');el.id='winner-splash';el.className='winner-splash';el.setAttribute('aria-live','assertive');el.innerHTML='<button type="button" class="winner-close" data-winner-close aria-label="Tutup paparan pemenang"><span class="winner-close-icon">✕</span><span>TUTUP</span></button><span class="winner-spark"></span><span class="winner-spark"></span><span class="winner-spark"></span><span class="winner-spark"></span><div class="winner-stage" id="winner-stage"></div>';document.body.appendChild(el);return el;
}
function closeWinner(){
  const el=document.querySelector('#winner-splash');if(!el||!winnerActive)return;
  el.classList.add('closing');
  setTimeout(()=>{el.classList.remove('open','closing','game-win');winnerActive=false;presentNextWinner()},360);
}
function winnerKey(m){return `match:${m.id}:${m.finished_at||m.updated_at||'finished'}`}
function gameWinnerKey(row){return `game:${row.match_id}:${row.game_number}:${row.winner_id}:${row.created_at||''}`}
function eligibleWinner(match,bundle){
  if(!match||match.status!=='finished'||!match.winner_id||!bundle?.activeGame)return false;
  if(match.game_id!==bundle.activeGame.id)return false;
  const station=selectedStation();return !station||String(match.station||'1')===String(station);
}
function eligibleGameWinner(row,match,bundle){
  if(!row?.winner_id||!match||bundle?.activeGame?.scoring_mode!=='series')return false;
  if(match.game_id!==bundle.activeGame.id)return false;
  const station=selectedStation();return !station||String(match.station||'1')===String(station);
}
function winnerMarkup(match,bundle){
  const winner=(root.teams||[]).find(t=>t.id===match.winner_id);
  const loserId=match.winner_id===match.team_a_id?match.team_b_id:match.team_a_id;
  const loser=(root.teams||[]).find(t=>t.id===loserId);
  const isSeries=bundle.activeGame?.scoring_mode==='series';
  const winnerWins=match.winner_id===match.team_a_id?Number(match.team_a_score||0):Number(match.team_b_score||0);
  const target=Math.floor(Number(match.best_of||bundle.activeGame?.default_best_of||1)/2)+1;
  const round=match.round_name||match.stage||'Perlawanan';
  return `<div class="winner-event">${esc(root.tournament.name)} · ${esc(bundle.activeGame.name)}</div>
    <div class="winner-crown">Official Series Result</div>
    <div class="winner-logo-shell">${winnerLogoHtml(winner)}</div>
    <div class="winner-label">Series Winner</div>
    <h1 class="winner-name">${esc(winner?.name||'Pemenang')}</h1>
    ${seriesDots(winnerWins,target)}
    <div class="winner-meta">
      <span>${esc(round)}</span>
      <span>Station ${esc(match.station||'1')}</span>
      <span>BO${Number(match.best_of||1)} · Series Complete</span>
      ${loser?`<span>vs ${esc(loser.name)}</span>`:''}
    </div>
    <div class="winner-accent"></div>
    <div class="winner-subtitle">Victory confirmed · official match result</div>`;
}
function gameWinnerMarkup(row,match,bundle){
  const winner=(root.teams||[]).find(t=>t.id===row.winner_id);
  const a=(root.teams||[]).find(t=>t.id===match.team_a_id),b=(root.teams||[]).find(t=>t.id===match.team_b_id);
  const round=match.round_name||match.stage||'Perlawanan';
  const kda=`${Number(row.mvp_kills||0)} / ${Number(row.mvp_deaths||0)} / ${Number(row.mvp_assists||0)}`;
  return `<div class="winner-event">${esc(root.tournament.name)} · ${esc(bundle.activeGame.name)}</div>
    <div class="winner-crown">Game ${Number(row.game_number||1)} · Official Result</div>
    <div class="winner-logo-shell game-logo">${winnerLogoHtml(winner)}</div>
    <div class="winner-label">Game ${Number(row.game_number||1)} Winner</div>
    <h1 class="winner-name">${esc(winner?.name||'Pemenang')}</h1>
    <div class="winner-game-stats">
      <div><small>Total Kill</small><strong>${Number(row.team_a_points||0)} <em>—</em> ${Number(row.team_b_points||0)}</strong><span>${esc(a?.short_name||a?.name||'A')} vs ${esc(b?.short_name||b?.name||'B')}</span></div>
      <div class="mvp"><small>Game MVP</small><strong>${esc(row.mvp_name||'—')}</strong><span>KDA ${esc(kda)}</span></div>
    </div>
    <div class="winner-meta"><span>${esc(round)}</span><span>Station ${esc(match.station||'1')}</span><span>BO${Number(match.best_of||1)}</span></div>
    <div class="winner-accent"></div>
    <div class="winner-subtitle">Game victory confirmed · tekan TUTUP untuk kembali ke live</div>`;
}
function presentNextWinner(){
  if(winnerActive||!winnerQueue.length)return;
  const item=winnerQueue.shift(),el=ensureWinnerSplash(),stage=el.querySelector('#winner-stage');
  if(!item||!stage)return;
  winnerActive=true;el.classList.toggle('game-win',item.type==='game');stage.innerHTML=item.type==='game'?gameWinnerMarkup(item.row,item.match,item.bundle):winnerMarkup(item.match,item.bundle);el.classList.remove('closing');requestAnimationFrame(()=>el.classList.add('open'));
}
function queueWinner(match,bundle,{force=false}={}){
  if(!eligibleWinner(match,bundle))return;
  const key=winnerKey(match);if(!force&&shownWinners.has(key))return;shownWinners.add(key);
  winnerQueue.push({type:'match',match:{...match},bundle:{...bundle,activeGame:{...bundle.activeGame}}});presentNextWinner();
}
function queueGameWinner(row,match,bundle){
  if(!eligibleGameWinner(row,match,bundle))return;
  const key=gameWinnerKey(row);if(shownWinners.has(key))return;shownWinners.add(key);
  winnerQueue.push({type:'game',row:{...row},match:{...match},bundle:{...bundle,activeGame:{...bundle.activeGame}}});presentNextWinner();
}
function maybeShowRecentWinner(bundle){
  const now=Date.now();
  const recent=(bundle.matches||[]).filter(m=>eligibleWinner(m,bundle)&&m.finished_at&&now-new Date(m.finished_at).getTime()>=0&&now-new Date(m.finished_at).getTime()<15000).sort((a,b)=>new Date(b.finished_at)-new Date(a.finished_at))[0];
  if(recent)queueWinner(recent,bundle);
}

function paint(){
  const raw=filterBundle(root,selectedCode);if(!raw.activeGame)return;
  selectedCode=raw.activeGame.code;
  const station=selectedStation();
  document.querySelector('#title').textContent=`${root.tournament.name} · ${raw.activeGame.name}${station?` · Station ${station}`:''}`;
  document.querySelector('#game-tabs').innerHTML=gameTabsHtml(root,selectedCode);
  document.querySelector('#live').innerHTML=liveHtml(raw);
  document.querySelector('#next').innerHTML=countdownHtml(raw)+nextMatchHtml(stationBundle(raw,station));
  tickCountdowns();
}
function selectGame(code){selectedCode=code;const u=new URL(location.href);u.searchParams.set('game',code);history.replaceState({},'',u);paint()}
async function boot(){
  try{
    root=await loadTournamentBundle();selectedCode=gameFromLocation(root)?.code;paint();
    const initial=filterBundle(root,selectedCode);maybeShowRecentWinner(initial);
    if(!countdownTimer)countdownTimer=setInterval(tickCountdowns,1000);
    if(!root.demo&&!sub)sub=subscribeTournament(root.tournament.id,p=>{
      applyRealtimeChange(root,p);const current=filterBundle(root,selectedCode);paint();
      const row=p?.new&&Object.keys(p.new).length?p.new:null;
      if(row?.status==='finished'&&row?.winner_id)queueWinner(row,current);
    });
  }catch(e){document.querySelector('#live').innerHTML=`<div class="notice error">${e.message}</div>`}
}
window.addEventListener('mlbb-game-result',e=>{
  const row=e.detail;if(!root||!row||row.eventType==='DELETE')return;
  const match=(root.matches||[]).find(m=>m.id===row.match_id);if(!match)return;
  const current=filterBundle(root,selectedCode);queueGameWinner(row,match,current);
});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-winner-close]')){closeWinner();return}
  const b=e.target.closest('[data-game]');if(b)selectGame(b.dataset.game)
});
boot();