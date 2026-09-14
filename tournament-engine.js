import { supabase } from './supabase-client.js';
import { calculateStandings } from './data.js';

const KNOCKOUT_STAGES=['roundof16','quarterfinal','semifinal','final'];
const LABELS={roundof16:'Pusingan 16',quarterfinal:'Suku Akhir',semifinal:'Separuh Akhir',final:'Grand Final'};

const shuffle=(items)=>{
  const out=[...items];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}
  return out;
};
const orderedTeams=(teams,mode='random')=>mode==='seeded'
  ? [...teams].sort((a,b)=>(a.seed_order??999)-(b.seed_order??999)||a.name.localeCompare(b.name))
  : shuffle(teams);
const isoAt=(startAt,minutes)=>startAt?new Date(new Date(startAt).getTime()+minutes*60000).toISOString():null;
const nextPow2=n=>2**Math.ceil(Math.log2(Math.max(2,n)));
const uiStationCount=()=>{try{return Number(document.querySelector('#generator-stations')?.value||1)}catch{return 1}};
const stationCount=value=>Math.max(1,Math.min(4,Number(value||uiStationCount()||1)));
const wavePlan=(waveBase,slot,startAt,intervalMinutes,count)=>{
  const stations=stationCount(count);
  return {
    station:String((slot%stations)+1),
    scheduled_at:isoAt(startAt,(waveBase+Math.floor(slot/stations))*Number(intervalMinutes||20))
  };
};

function bracketDefs(size){
  if(size>16) throw new Error('Generator automatik sekarang menyokong maksimum 16 pasukan untuk satu bracket.');
  const defs=[];
  for(let count=size/2;count>=1;count/=2){
    const stage=count===8?'roundof16':count===4?'quarterfinal':count===2?'semifinal':'final';
    defs.push({stage,count,label:LABELS[stage]});
  }
  return defs;
}
function roundRobin(ids){
  const list=[...ids];if(list.length%2)list.push(null);
  const rounds=[],n=list.length;
  for(let r=0;r<n-1;r++){
    const pairs=[];
    for(let i=0;i<n/2;i++){const a=list[i],b=list[n-1-i];if(a&&b)pairs.push([a,b])}
    rounds.push(pairs);list.splice(1,0,list.pop());
  }
  return rounds;
}
async function removeGenerated(tournamentId,gameId,scope='all'){
  let q=supabase.from('matches').delete().eq('tournament_id',tournamentId).eq('game_id',gameId).eq('auto_generated',true);
  if(scope==='knockout')q=q.in('stage',KNOCKOUT_STAGES);
  const {error}=await q;if(error)throw error;
}
async function insertMatches(payloads){
  if(!payloads.length)return [];
  const {data,error}=await supabase.from('matches').insert(payloads).select('id,stage,bracket_round,bracket_position,next_match_id,next_match_slot,team_a_id,team_b_id,status,winner_id,station,scheduled_at');
  if(error)throw error;return data||[];
}
async function markBye(row,winnerId){
  const {error}=await supabase.from('matches').update({status:'finished',winner_id:winnerId,finished_at:new Date().toISOString()}).eq('id',row.id);if(error)throw error;
  if(row.next_match_id&&row.next_match_slot){const field=row.next_match_slot==='a'?'team_a_id':'team_b_id';const {error:nErr}=await supabase.from('matches').update({[field]:winnerId}).eq('id',row.next_match_id);if(nErr)throw nErr}
}

async function buildKnockout(bundle,gameId,{pairing='random',bestOf=1,startAt=null,intervalMinutes=20,replaceScope='all',customPairs=null,stationCount:stationCountOption}={}){
  const game=bundle.games.find(g=>g.id===gameId);if(!game)throw new Error('Game tidak ditemui.');
  let teams=bundle.teams.filter(t=>t.game_id===gameId);if(teams.length<2)throw new Error('Sekurang-kurangnya 2 pasukan diperlukan.');
  if(teams.length>16&&!customPairs)throw new Error('Maksimum 16 pasukan untuk bracket automatik.');
  if(replaceScope)await removeGenerated(bundle.tournament.id,gameId,replaceScope);

  const stations=stationCount(stationCountOption);
  let firstPairs,size;
  if(customPairs){firstPairs=customPairs;size=customPairs.length*2}
  else{
    teams=orderedTeams(teams,pairing);size=nextPow2(teams.length);
    const slots=[...teams,...Array(size-teams.length).fill(null)];firstPairs=[];
    for(let i=0;i<size/2;i++)firstPairs.push([slots[i]?.id||null,slots[size-1-i]?.id||null]);
  }

  const defs=bracketDefs(size);
  let waveBase=0;
  for(const d of defs){d.waveBase=waveBase;waveBase+=Math.ceil(d.count/stations)}
  const inserted=new Array(defs.length);let nextRows=null;

  for(let i=defs.length-1;i>=0;i--){
    const d=defs[i];
    const payloads=Array.from({length:d.count},(_,j)=>{
      const first=i===0?firstPairs[j]:[null,null],plan=wavePlan(d.waveBase,j,startAt,intervalMinutes,stations);
      return {tournament_id:bundle.tournament.id,game_id:gameId,stage:d.stage,round_name:d.label,team_a_id:first?.[0]||null,team_b_id:first?.[1]||null,best_of:Number(bestOf||game.default_best_of||1),scheduled_at:plan.scheduled_at,station:plan.station,status:'scheduled',bracket_round:i+1,bracket_position:j+1,next_match_id:nextRows?nextRows[Math.floor(j/2)]?.id:null,next_match_slot:nextRows?(j%2===0?'a':'b'):null,auto_generated:true};
    });
    const rows=await insertMatches(payloads);inserted[i]=rows;nextRows=rows;
  }

  const firstRows=inserted[0]||[];
  for(let i=0;i<firstRows.length;i++){const [a,b]=firstPairs[i]||[];if((a&&!b)||(!a&&b))await markBye(firstRows[i],a||b)}
  return {format:'single_elimination',matches:defs.reduce((s,d)=>s+d.count,0),bracketSize:size,stations};
}

export async function generateSingleElimination(bundle,gameId,opts={}){return buildKnockout(bundle,gameId,{...opts,replaceScope:'all'})}

export async function generateLeague(bundle,gameId,{pairing='random',bestOf=1,startAt=null,intervalMinutes=20,stationCount:stationCountOption}={}){
  const game=bundle.games.find(g=>g.id===gameId);if(!game)throw new Error('Game tidak ditemui.');
  const teams=orderedTeams(bundle.teams.filter(t=>t.game_id===gameId),pairing);if(teams.length<2)throw new Error('Sekurang-kurangnya 2 pasukan diperlukan.');if(teams.length>16)throw new Error('Had generator liga ditetapkan 16 pasukan untuk event ini.');
  await removeGenerated(bundle.tournament.id,gameId,'all');
  const stations=stationCount(stationCountOption),rounds=roundRobin(teams.map(t=>t.id)),payloads=[];let waveBase=0;
  rounds.forEach((pairs,r)=>{
    pairs.forEach(([a,b],i)=>{const plan=wavePlan(waveBase,i,startAt,intervalMinutes,stations);payloads.push({tournament_id:bundle.tournament.id,game_id:gameId,stage:'league',round_name:`Liga · Pusingan ${r+1}`,team_a_id:a,team_b_id:b,best_of:Number(bestOf||game.default_best_of||1),scheduled_at:plan.scheduled_at,station:plan.station,status:'scheduled',auto_generated:true})});
    waveBase+=Math.ceil(pairs.length/stations);
  });
  await insertMatches(payloads);return {format:'league',matches:payloads.length,rounds:rounds.length,stations};
}

export async function generateGroups(bundle,gameId,{pairing='random',groupCount=4,bestOf=1,startAt=null,intervalMinutes=20,stationCount:stationCountOption}={}){
  const game=bundle.games.find(g=>g.id===gameId);if(!game)throw new Error('Game tidak ditemui.');
  const teams=orderedTeams(bundle.teams.filter(t=>t.game_id===gameId),pairing),groupsN=Number(groupCount||4);
  if(![2,4].includes(groupsN))throw new Error('Gunakan 2 atau 4 kumpulan.');
  if(teams.length<groupsN*2)throw new Error(`Sekurang-kurangnya ${groupsN*2} pasukan diperlukan untuk ${groupsN} kumpulan.`);
  if(teams.length>16)throw new Error('Had generator group ditetapkan 16 pasukan untuk event ini.');
  await removeGenerated(bundle.tournament.id,gameId,'all');
  const stations=stationCount(stationCountOption),groups=Array.from({length:groupsN},()=>[]);
  teams.forEach((t,i)=>{const cycle=Math.floor(i/groupsN),pos=i%groupsN,gi=pairing==='seeded'&&cycle%2===1?groupsN-1-pos:pos;groups[gi].push(t)});
  const payloads=[];let waveBase=0;
  groups.forEach((group,gi)=>{
    const label=String.fromCharCode(65+gi),rounds=roundRobin(group.map(t=>t.id));
    rounds.forEach((pairs,r)=>{
      pairs.forEach(([a,b],i)=>{const plan=wavePlan(waveBase,i,startAt,intervalMinutes,stations);payloads.push({tournament_id:bundle.tournament.id,game_id:gameId,stage:'group',group_name:label,round_name:`Kumpulan ${label} · Pusingan ${r+1}`,team_a_id:a,team_b_id:b,best_of:Number(bestOf||game.default_best_of||1),scheduled_at:plan.scheduled_at,station:plan.station,status:'scheduled',auto_generated:true})});
      waveBase+=Math.ceil(pairs.length/stations);
    });
  });
  await insertMatches(payloads);return {format:'group_knockout',matches:payloads.length,groups:groupsN,stations};
}

export async function generateKnockoutFromGroups(bundle,gameId,{bestOf=1,startAt=null,intervalMinutes=20,stationCount:stationCountOption}={}){
  const groupMatches=bundle.matches.filter(m=>m.game_id===gameId&&m.stage==='group'&&m.group_name);if(!groupMatches.length)throw new Error('Tiada perlawanan kumpulan dijumpai.');if(groupMatches.some(m=>m.status!=='finished'))throw new Error('Selesaikan semua perlawanan kumpulan dahulu.');
  const labels=[...new Set(groupMatches.map(m=>m.group_name))].sort();if(![2,4].includes(labels.length))throw new Error('Knockout automatik Top 2 menyokong 2 atau 4 kumpulan.');
  const top={};
  for(const label of labels){const ms=groupMatches.filter(m=>m.group_name===label),ids=[...new Set(ms.flatMap(m=>[m.team_a_id,m.team_b_id]).filter(Boolean))],teams=bundle.teams.filter(t=>ids.includes(t.id)),standings=calculateStandings(teams,ms);if(standings.length<2)throw new Error(`Kumpulan ${label} belum mempunyai Top 2 yang sah.`);top[label]=standings.slice(0,2).map(s=>s.team_id)}
  let pairs;if(labels.length===2){const [A,B]=labels;pairs=[[top[A][0],top[B][1]],[top[B][0],top[A][1]]]}else{const [A,B,C,D]=labels;pairs=[[top[A][0],top[B][1]],[top[C][0],top[D][1]],[top[B][0],top[A][1]],[top[D][0],top[C][1]]]}
  return buildKnockout(bundle,gameId,{bestOf,startAt,intervalMinutes,stationCount:stationCountOption,replaceScope:'knockout',customPairs:pairs});
}

export async function removeAutoGeneratedMatches(bundle,gameId){await removeGenerated(bundle.tournament.id,gameId,'all')}

function installStationSelector(){
  if(typeof document==='undefined'||document.querySelector('#generator-stations'))return;
  const interval=document.querySelector('#generator-interval'),form=document.querySelector('#generator-form');if(!interval||!form)return;
  const field=document.createElement('div');field.className='field';field.innerHTML='<label>Jumlah Station / Setup Serentak</label><select id="generator-stations"><option value="1">1 Station</option><option value="2">2 Station</option><option value="3">3 Station</option><option value="4">4 Station</option></select><div class="auto-seed-note">Match akan diagih automatik ke station. Match dalam gelombang sama berkongsi waktu mula.</div>';interval.closest('.field')?.insertAdjacentElement('afterend',field);
  const select=field.querySelector('select');
  const restore=()=>{const gid=document.querySelector('#generator-game')?.value||'default';try{select.value=localStorage.getItem(`esports-stations-${gid}`)||'1'}catch{select.value='1'}};
  restore();select.addEventListener('change',()=>{const gid=document.querySelector('#generator-game')?.value||'default';try{localStorage.setItem(`esports-stations-${gid}`,select.value)}catch{}});document.querySelector('#generator-game')?.addEventListener('change',restore);
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installStationSelector,{once:true});else queueMicrotask(installStationSelector)}
