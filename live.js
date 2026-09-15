import './series-style-loader.js?v=series3';
import './mlbb-result-public.js?v=series3';
import { loadTournamentBundle, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation } from './data.js';
import { liveMatchHtml, nextMatchHtml, gameTabsHtml } from './ui.js?v=series3';
let sub,root,selectedCode,countdownTimer;
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
async function boot(){try{root=await loadTournamentBundle();selectedCode=gameFromLocation(root)?.code;paint();if(!countdownTimer)countdownTimer=setInterval(tickCountdowns,1000);if(!root.demo&&!sub)sub=subscribeTournament(root.tournament.id,p=>{applyRealtimeChange(root,p);paint()})}catch(e){document.querySelector('#live').innerHTML=`<div class="notice error">${e.message}</div>`}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(b)selectGame(b.dataset.game)});
boot();
