import { loadTournamentBundle, teamMap, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation } from './data.js';

let sub,root,selectedCode;
const params=()=>{try{return new URLSearchParams(location.search)}catch{return new URLSearchParams()}};
const selectedStation=()=>params().get('station')||'';
const selectedMode=()=>String(params().get('mode')||'single').toLowerCase();
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const stationNo=m=>String(m?.station||'1');
const stationSort=(a,b)=>Number(stationNo(a))-Number(stationNo(b));

function bestOfLabel(bundle,m){
  return bundle.activeGame?.scoring_mode==='goals'?'GOALS':`BO${m.best_of||bundle.activeGame?.default_best_of||1}`;
}

function singleMatch(bundle,m,station=''){
  const overlay=document.querySelector('#overlay'),tm=teamMap(bundle.teams);
  if(!m){overlay.className='overlay-box hidden';return}
  overlay.className='overlay-box';
  overlay.innerHTML=`
    <div class="overlay-game" id="game">${esc(bundle.activeGame?.code?.toUpperCase()||'')}${station?` · S${esc(station)}`:m.station?` · S${esc(m.station)}`:''}</div>
    <div id="a" class="overlay-team">${esc(tm[m.team_a_id]?.name||'TBD')}</div>
    <div class="overlay-score"><span id="sa">${Number(m.team_a_score||0)}</span><span>—</span><span id="sb">${Number(m.team_b_score||0)}</span></div>
    <div id="b" class="overlay-team right">${esc(tm[m.team_b_id]?.name||'TBD')}</div>`;
}

function multiviewMatches(bundle){
  const live=bundle.matches.filter(m=>m.status==='live').sort(stationSort);
  if(live.length)return live;

  const scheduled=bundle.matches
    .filter(m=>m.status==='scheduled'&&m.team_a_id&&m.team_b_id)
    .sort((a,b)=>new Date(a.scheduled_at||0)-new Date(b.scheduled_at||0)||stationSort(a,b));
  const perStation=new Map();
  for(const m of scheduled){const s=stationNo(m);if(!perStation.has(s))perStation.set(s,m)}
  return [...perStation.values()].sort(stationSort);
}

function multiview(bundle){
  const overlay=document.querySelector('#overlay'),tm=teamMap(bundle.teams),matches=multiviewMatches(bundle);
  if(!matches.length){overlay.className='overlay-multiview hidden';return}
  overlay.className='overlay-multiview';
  overlay.innerHTML=matches.map(m=>{
    const isLive=m.status==='live';
    return `<section class="overlay-station-card ${isLive?'is-live':'is-scheduled'}">
      <div class="overlay-station-head">
        <span>STATION ${esc(stationNo(m))}</span>
        <span class="overlay-mini-status">${isLive?'LIVE':'NEXT'} · ${esc(bestOfLabel(bundle,m))}</span>
      </div>
      <div class="overlay-station-match">
        <div class="overlay-station-team"><span class="overlay-station-name">${esc(tm[m.team_a_id]?.name||'TBD')}</span><strong>${Number(m.team_a_score||0)}</strong></div>
        <div class="overlay-station-vs">VS</div>
        <div class="overlay-station-team right"><strong>${Number(m.team_b_score||0)}</strong><span class="overlay-station-name">${esc(tm[m.team_b_id]?.name||'TBD')}</span></div>
      </div>
      <div class="overlay-station-round">${esc(m.round_name||'Perlawanan')} · ${esc(bundle.activeGame?.code?.toUpperCase()||'GAME')}</div>
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

async function boot(){
  root=await loadTournamentBundle();
  selectedCode=gameFromLocation(root)?.code;
  paint();
  if(!root.demo&&!sub)sub=subscribeTournament(root.tournament.id,p=>{applyRealtimeChange(root,p);paint()});
}

boot().catch(()=>document.querySelector('#overlay').classList.add('hidden'));
