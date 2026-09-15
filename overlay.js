import './series-style-loader.js?v=series1';
import { supabase, isConfigured } from './supabase-client.js';
import { loadTournamentBundle, teamMap, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation, initials } from './data.js';

let sub,resultChannel,root,selectedCode,celebrationActive=false,celebrationTimer=null;
const celebrationQueue=[];
const shownWins=new Set();
const params=()=>{try{return new URLSearchParams(location.search)}catch{return new URLSearchParams()}};
const selectedStation=()=>params().get('station')||'';
const selectedMode=()=>String(params().get('mode')||'single').toLowerCase();
const celebrationMode=()=>String(params().get('celebration')||'manual').toLowerCase();
const celebrationDuration=()=>Math.max(3000,Math.min(30000,Number(params().get('duration')||10000)));
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const stationNo=m=>String(m?.station||'1');
const stationSort=(a,b)=>Number(stationNo(a))-Number(stationNo(b));
const seriesTarget=m=>Math.floor(Number(m?.best_of||1)/2)+1;
function seriesPips(wins,target,side='a',compact=false){const out=[];for(let i=0;i<target;i++)out.push(`<span class="series-pip ${i<Number(wins||0)?'on':''}"></span>`);return `<span class="series-pips ${side}${compact?' compact':''}">${out.join('')}</span>`}
function safeLogoUrl(value){const raw=String(value||'').trim();if(!raw)return '';try{const u=new URL(raw,location.origin);return ['http:','https:'].includes(u.protocol)?esc(u.href):''}catch{return ''}}
function logo(team){const src=safeLogoUrl(team?.logo_url),text=esc(team?.short_name||initials(team?.name||'TM'));return `<span class="overlay-team-logo${src?' has-logo':''}">${src?`<img src="${src}" alt="" onerror="this.remove();this.parentElement.classList.remove('has-logo')">`:''}<span>${text}</span></span>`}
function celebrationLogo(team){const src=safeLogoUrl(team?.logo_url),text=esc(team?.short_name||initials(team?.name||'TM'));return `<div class="obs-win-logo">${src?`<img src="${src}" alt="${esc(team?.name||'Pemenang')}">`:`<span>${text}</span>`}</div>`}

function bestOfLabel(bundle,m){return `BO${m.best_of||bundle.activeGame?.default_best_of||1}`}
function teamSeries(bundle,m,side){const score=side==='a'?m.team_a_score:m.team_b_score;return `<span class="overlay-team-series">${seriesPips(score,seriesTarget(m),side)}<small>GAME WIN</small></span>`}

function singleMatch(bundle,m,station=''){
  const overlay=document.querySelector('#overlay'),tm=teamMap(bundle.teams);
  if(!m){overlay.className='overlay-box hidden';return}
  const a=tm[m.team_a_id],b=tm[m.team_b_id];
  overlay.className='overlay-box';
  overlay.innerHTML=`
    <div class="overlay-game" id="game">MLBB${station?` · S${esc(station)}`:m.station?` · S${esc(m.station)}`:''}</div>
    <div id="a" class="overlay-team"><span class="overlay-team-wrap">${logo(a)}<span>${esc(a?.name||'TBD')}</span></span>${teamSeries(bundle,m,'a')}</div>
    <div class="overlay-series-label"><strong>BO${m.best_of||1}</strong><small>FIRST TO ${seriesTarget(m)}</small></div>
    <div id="b" class="overlay-team right"><span class="overlay-team-wrap right">${logo(b)}<span>${esc(b?.name||'TBD')}</span></span>${teamSeries(bundle,m,'b')}</div>`;
}

function multiviewMatches(bundle){
  const live=bundle.matches.filter(m=>m.status==='live').sort(stationSort);
  if(live.length)return live;
  const scheduled=bundle.matches.filter(m=>m.status==='scheduled'&&m.team_a_id&&m.team_b_id).sort((a,b)=>new Date(a.scheduled_at||0)-new Date(b.scheduled_at||0)||stationSort(a,b));
  const perStation=new Map();for(const m of scheduled){const s=stationNo(m);if(!perStation.has(s))perStation.set(s,m)}return [...perStation.values()].sort(stationSort);
}

function multiview(bundle){
  const overlay=document.querySelector('#overlay'),tm=teamMap(bundle.teams),matches=multiviewMatches(bundle);
  if(!matches.length){overlay.className='overlay-multiview hidden';return}
  overlay.className='overlay-multiview';
  overlay.innerHTML=matches.map(m=>{
    const isLive=m.status==='live',a=tm[m.team_a_id],b=tm[m.team_b_id];
    const aScore=seriesPips(m.team_a_score,seriesTarget(m),'a','compact');
    const bScore=seriesPips(m.team_b_score,seriesTarget(m),'b','compact');
    return `<section class="overlay-station-card ${isLive?'is-live':'is-scheduled'}">
      <div class="overlay-station-head"><span>STATION ${esc(stationNo(m))}</span><span class="overlay-mini-status">${isLive?'LIVE':'NEXT'} · ${esc(bestOfLabel(bundle,m))}</span></div>
      <div class="overlay-station-match">
        <div class="overlay-station-team"><span class="overlay-team-wrap">${logo(a)}<span class="overlay-station-name">${esc(a?.name||'TBD')}</span></span>${aScore}</div>
        <div class="overlay-station-vs">VS</div>
        <div class="overlay-station-team right">${bScore}<span class="overlay-team-wrap right">${logo(b)}<span class="overlay-station-name">${esc(b?.name||'TBD')}</span></span></div>
      </div>
      <div class="overlay-station-round">${esc(m.round_name||'Perlawanan')} · MLBB · FIRST TO ${seriesTarget(m)}</div>
    </section>`;
  }).join('');
}

function paint(){
  const bundle=filterBundle(root,selectedCode),station=selectedStation(),mode=selectedMode();
  if(mode==='multiview')return multiview(bundle);
  const matches=station?bundle.matches.filter(x=>stationNo(x)===String(station)):bundle.matches;
  const m=matches.find(x=>x.status==='live')||matches.find(x=>x.status==='scheduled');
  singleMatch(bundle,m,station);
}

function matchFor(id){return (root?.matches||[]).find(m=>m.id===id)||null}
function teamFor(id){return (root?.teams||[]).find(t=>t.id===id)||null}
function eligibleResult(row,match){
  if(!row?.winner_id||!match)return false;
  const station=selectedStation();if(station&&stationNo(match)!==String(station))return false;
  const game=(root?.games||[]).find(g=>g.id===match.game_id);return game?.code==='mlbb';
}
async function seriesRows(matchId){
  const {data,error}=await supabase.from('match_games').select('game_number,winner_id,team_a_points,team_b_points,mvp_name,mvp_kills,mvp_deaths,mvp_assists,created_at').eq('match_id',matchId).order('game_number',{ascending:true});
  if(error)throw error;return data||[];
}
function seriesSummary(match,rows){
  let winA=0,winB=0,killA=0,killB=0;
  for(const r of rows){if(r.winner_id===match.team_a_id)winA++;if(r.winner_id===match.team_b_id)winB++;killA+=Number(r.team_a_points||0);killB+=Number(r.team_b_points||0)}
  return {winA,winB,killA,killB};
}
function winnerPips(winnerId,match,summary){
  const wins=winnerId===match.team_a_id?summary.winA:summary.winB,target=seriesTarget(match);
  return `<div class="obs-win-pips" aria-label="${wins} daripada ${target} game win">${Array.from({length:target},(_,i)=>`<span class="obs-win-pip ${i<wins?'on':''}"></span>`).join('')}</div>`;
}
function ensureCelebration(){
  let el=document.querySelector('#obs-win-celebration');if(el)return el;
  el=document.createElement('div');el.id='obs-win-celebration';el.className='obs-win-celebration';el.innerHTML='<div class="obs-win-card" id="obs-win-card"></div>';document.body.appendChild(el);return el;
}
function celebrationMarkup(item){
  const {row,match,summary}=item,winner=teamFor(row.winner_id),a=teamFor(match.team_a_id),b=teamFor(match.team_b_id);
  const kda=`${Number(row.mvp_kills||0)}/${Number(row.mvp_deaths||0)}/${Number(row.mvp_assists||0)}`;
  return `<button type="button" class="obs-win-close" data-obs-win-close aria-label="Tutup celebration">✕</button>
    <div class="obs-win-head"><span class="event">${esc(root?.tournament?.name||'PesMAC MLBB')} · Station ${esc(stationNo(match))}</span><span class="official">GAME ${Number(row.game_number||1)} · OFFICIAL</span></div>
    <div class="obs-win-main">
      <div class="obs-win-logo-shell">${celebrationLogo(winner)}</div>
      <div class="obs-win-kicker">Game ${Number(row.game_number||1)} Winner</div>
      <h1 class="obs-win-name">${esc(winner?.name||'Pemenang')}</h1>
      ${winnerPips(row.winner_id,match,summary)}
    </div>
    <div class="obs-win-stats">
      <div class="obs-win-stat"><small>Series</small><strong>${summary.winA}–${summary.winB}</strong><span>${esc(a?.short_name||a?.name||'A')} vs ${esc(b?.short_name||b?.name||'B')}</span></div>
      <div class="obs-win-stat"><small>Game Kill</small><strong>${Number(row.team_a_points||0)}–${Number(row.team_b_points||0)}</strong><span>Total siri ${summary.killA}–${summary.killB}</span></div>
      <div class="obs-win-stat mvp"><small>Game MVP</small><strong>${esc(row.mvp_name||'—')}</strong><span>Most Valuable Player</span></div>
      <div class="obs-win-stat"><small>KDA</small><strong>${esc(kda)}</strong><span>K / D / A</span></div>
    </div>
    <div class="obs-win-foot"><span>${esc(match.round_name||match.stage||'Perlawanan')}</span><span>BO${Number(match.best_of||1)}</span><span>MLBB</span>${celebrationMode()==='manual'?'<span>Interact OBS → ✕ untuk tutup</span>':''}</div>`;
}
function closeCelebration(){
  const el=document.querySelector('#obs-win-celebration');if(!el||!celebrationActive)return;
  clearTimeout(celebrationTimer);el.classList.add('closing');setTimeout(()=>{el.classList.remove('open','closing');celebrationActive=false;presentNextCelebration()},300);
}
function presentNextCelebration(){
  if(celebrationActive||!celebrationQueue.length)return;
  const item=celebrationQueue.shift(),el=ensureCelebration(),card=el.querySelector('#obs-win-card');if(!item||!card)return;
  celebrationActive=true;card.innerHTML=celebrationMarkup(item);el.classList.remove('closing');requestAnimationFrame(()=>el.classList.add('open'));
  clearTimeout(celebrationTimer);if(celebrationMode()==='auto')celebrationTimer=setTimeout(closeCelebration,celebrationDuration());
}
async function queueResult(row){
  const match=matchFor(row.match_id);if(!eligibleResult(row,match))return;
  const key=`${row.match_id}:${row.game_number}:${row.winner_id}`;if(shownWins.has(key))return;shownWins.add(key);
  try{const rows=await seriesRows(row.match_id),summary=seriesSummary(match,rows);celebrationQueue.push({row:{...row},match:{...match},summary});presentNextCelebration()}catch{}
}
async function maybeShowRecentResult(){
  if(!isConfigured()||!supabase)return;
  const bundle=filterBundle(root,selectedCode),station=selectedStation();let matches=bundle.matches||[];if(station)matches=matches.filter(m=>stationNo(m)===String(station));
  const ids=matches.map(m=>m.id).filter(Boolean);if(!ids.length)return;
  const cutoff=new Date(Date.now()-20000).toISOString();
  const {data,error}=await supabase.from('match_games').select('match_id,game_number,team_a_points,team_b_points,winner_id,mvp_name,mvp_kills,mvp_deaths,mvp_assists,created_at').in('match_id',ids).gte('created_at',cutoff).order('created_at',{ascending:false}).limit(1);
  if(!error&&data?.[0])queueResult(data[0]);
}
function bindResultRealtime(){
  if(resultChannel||!isConfigured()||!supabase)return;
  resultChannel=supabase.channel(`obs-mlbb-results-${selectedStation()||'all'}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'match_games'},payload=>{const row=payload.new;if(row?.match_id)queueResult(row)}).subscribe();
}
async function boot(){
  root=await loadTournamentBundle();selectedCode=gameFromLocation(root)?.code;paint();bindResultRealtime();maybeShowRecentResult();
  if(!root.demo&&!sub)sub=subscribeTournament(root.tournament.id,p=>{applyRealtimeChange(root,p);paint()});
}
document.addEventListener('click',e=>{if(e.target.closest('[data-obs-win-close]'))closeCelebration()});
window.addEventListener('beforeunload',()=>{if(resultChannel&&supabase)supabase.removeChannel(resultChannel)});
boot().catch(()=>document.querySelector('#overlay').classList.add('hidden'));
