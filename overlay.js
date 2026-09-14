import { loadTournamentBundle, teamMap, subscribeTournament, applyRealtimeChange, filterBundle, gameFromLocation } from './data.js';
let sub,root,selectedCode;
const selectedStation=()=>{try{return new URLSearchParams(location.search).get('station')||''}catch{return ''}};
function paint(){
  const bundle=filterBundle(root,selectedCode),station=selectedStation();
  const matches=station?bundle.matches.filter(x=>String(x.station||'1')===String(station)):bundle.matches;
  const tm=teamMap(bundle.teams),m=matches.find(x=>x.status==='live')||matches.find(x=>x.status==='scheduled');
  if(!m){document.querySelector('#overlay').classList.add('hidden');return}
  document.querySelector('#overlay').classList.remove('hidden');
  document.querySelector('#game').textContent=`${bundle.activeGame?.code?.toUpperCase()||''}${station?` · S${station}`:m.station?` · S${m.station}`:''}`;
  document.querySelector('#a').textContent=tm[m.team_a_id]?.name||'TBD';
  document.querySelector('#b').textContent=tm[m.team_b_id]?.name||'TBD';
  document.querySelector('#sa').textContent=m.team_a_score||0;
  document.querySelector('#sb').textContent=m.team_b_score||0;
}
async function boot(){root=await loadTournamentBundle();selectedCode=gameFromLocation(root)?.code;paint();if(!root.demo&&!sub)sub=subscribeTournament(root.tournament.id,p=>{applyRealtimeChange(root,p);paint()})}
boot().catch(()=>document.querySelector('#overlay').classList.add('hidden'));
