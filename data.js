import { supabase, isConfigured } from './supabase-client.js';
import { CONFIG } from './config.js';
import { demoTournament, demoGames, demoTeams, demoMatches } from './demo-data.js';

const TOURNAMENT_COLUMNS = 'id,slug,name,venue,starts_at,ends_at,status,updated_at';
const GAME_COLUMNS = 'id,tournament_id,code,name,team_size,scoring_mode,default_best_of,allow_draws,sort_order,is_active';
const TEAM_COLUMNS = 'id,tournament_id,game_id,name,short_name,logo_url,seed_order';
const MATCH_COLUMNS = 'id,tournament_id,game_id,stage,round_name,team_a_id,team_b_id,team_a_score,team_b_score,team_a_tiebreak,team_b_tiebreak,best_of,scheduled_at,station,status,winner_id,started_at,finished_at,updated_at';
const CACHE_KEY = `scoreboard-static:${CONFIG.DEFAULT_TOURNAMENT_SLUG}:v2`;
const STATIC_CACHE_MS = 10 * 60 * 1000;

export const teamMap = (teams=[]) => Object.fromEntries(teams.map(t => [t.id, t]));
export const gameMap = (games=[]) => Object.fromEntries(games.map(g => [g.id, g]));
export const fmtTime = (iso) => iso ? new Intl.DateTimeFormat('ms-MY',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso)) : '—';
export const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('ms-MY',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(iso)) : '—';
export const initials = (name='?') => name.split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase();
export const maxWins = (bestOf=1) => Math.floor(Number(bestOf)/2)+1;

function getStaticCache(){
  try{
    const raw=sessionStorage.getItem(CACHE_KEY); if(!raw) return null;
    const parsed=JSON.parse(raw); if(Date.now()-parsed.savedAt>STATIC_CACHE_MS) return null;
    return parsed;
  }catch{return null}
}
function setStaticCache(tournament,games,teams){
  try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),tournament,games,teams}))}catch{}
}
export function clearStaticCache(){ try{sessionStorage.removeItem(CACHE_KEY)}catch{} }

export function calculateStandings(teams=[],matches=[]){
  const rows=new Map(teams.map(t=>[t.id,{tournament_id:t.tournament_id,game_id:t.game_id,team_id:t.id,played:0,wins:0,draws:0,losses:0,points:0,score_for:0,score_against:0}]));
  for(const m of matches){
    if(m.status!=='finished'||m.stage!=='group'||!m.team_a_id||!m.team_b_id) continue;
    const a=rows.get(m.team_a_id), b=rows.get(m.team_b_id); if(!a||!b) continue;
    a.played++; b.played++;
    a.score_for+=Number(m.team_a_score||0); a.score_against+=Number(m.team_b_score||0);
    b.score_for+=Number(m.team_b_score||0); b.score_against+=Number(m.team_a_score||0);
    if(m.winner_id===m.team_a_id){a.wins++;a.points+=3;b.losses++}
    else if(m.winner_id===m.team_b_id){b.wins++;b.points+=3;a.losses++}
    else if(Number(m.team_a_score)===Number(m.team_b_score)){a.draws++;b.draws++;a.points++;b.points++}
  }
  const sorted=[...rows.values()].sort((x,y)=>y.points-x.points||y.wins-x.wins||((y.score_for-y.score_against)-(x.score_for-x.score_against))||y.score_for-x.score_for);
  let lastKey=null,lastPos=0;
  return sorted.map((r,i)=>{const key=`${r.points}|${r.wins}|${r.score_for-r.score_against}|${r.score_for}`;if(key!==lastKey){lastPos=i+1;lastKey=key}return{...r,position:lastPos}});
}

export function resolveGame(bundle, ref){
  const active=(bundle.games||[]).filter(g=>g.is_active!==false).sort((a,b)=>(a.sort_order||99)-(b.sort_order||99));
  if(!active.length) return null;
  if(ref){
    const exact=active.find(g=>g.id===ref||g.code===String(ref).toLowerCase());
    if(exact) return exact;
  }
  const live=bundle.matches?.find(m=>m.status==='live');
  if(live){ const g=active.find(x=>x.id===live.game_id); if(g) return g; }
  return active[0];
}

export function filterBundle(bundle, gameRef){
  const activeGame=resolveGame(bundle,gameRef);
  if(!activeGame) return {...bundle,activeGame:null,teams:[],matches:[],standings:[]};
  const teams=(bundle.teams||[]).filter(t=>t.game_id===activeGame.id);
  const matches=(bundle.matches||[]).filter(m=>m.game_id===activeGame.id);
  return {...bundle,activeGame,teams,matches,standings:calculateStandings(teams,matches)};
}

export function gameFromLocation(bundle){
  try{return resolveGame(bundle,new URLSearchParams(location.search).get('game'))}catch{return resolveGame(bundle)}
}

export function gameUrl(path,game){
  const code=typeof game==='string'?game:game?.code;
  return code?`${path}?game=${encodeURIComponent(code)}`:path;
}

async function loadEdgeSnapshot(){
  if(!CONFIG.USE_CLOUDFLARE_EDGE_CACHE || !CONFIG.PUBLIC_SNAPSHOT_URL || location.protocol==='file:') return null;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),2500);
  try{
    const url=new URL(CONFIG.PUBLIC_SNAPSHOT_URL,location.origin); url.searchParams.set('slug',CONFIG.DEFAULT_TOURNAMENT_SLUG);
    const res=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});
    if(!res.ok) return null;
    const body=await res.json();
    if(!body?.tournament||!Array.isArray(body.games)||!Array.isArray(body.teams)||!Array.isArray(body.matches)) return null;
    setStaticCache(body.tournament,body.games,body.teams);
    return {tournament:body.tournament,games:body.games,teams:body.teams,matches:body.matches,demo:false,edge:true};
  }catch{return null}finally{clearTimeout(timer)}
}

export async function loadTournamentBundle({forceStatic=false,preferEdge=true}={}) {
  if (!isConfigured()) return { tournament:demoTournament, games:demoGames, teams:demoTeams, matches:demoMatches, demo:true };
  if(preferEdge && !forceStatic){ const edge=await loadEdgeSnapshot(); if(edge) return edge; }

  const cached=!forceStatic?getStaticCache():null;
  let tournament=cached?.tournament||null, games=cached?.games||null, teams=cached?.teams||null;

  if(!tournament){
    const { data, error } = await supabase.from('tournaments').select(TOURNAMENT_COLUMNS).eq('slug',CONFIG.DEFAULT_TOURNAMENT_SLUG).maybeSingle();
    if(error) throw error; tournament=data;
    if(!tournament) throw new Error(`Tournament slug "${CONFIG.DEFAULT_TOURNAMENT_SLUG}" tidak ditemui.`);
  }
  if(!games||!teams){
    const [gRes,tRes]=await Promise.all([
      supabase.from('games').select(GAME_COLUMNS).eq('tournament_id',tournament.id).order('sort_order',{ascending:true}),
      supabase.from('teams').select(TEAM_COLUMNS).eq('tournament_id',tournament.id).order('seed_order',{ascending:true})
    ]);
    if(gRes.error) throw gRes.error; if(tRes.error) throw tRes.error;
    games=gRes.data||[]; teams=tRes.data||[]; setStaticCache(tournament,games,teams);
  }

  const {data:matches,error:mErr}=await supabase.from('matches').select(MATCH_COLUMNS).eq('tournament_id',tournament.id).order('scheduled_at',{ascending:true});
  if(mErr) throw mErr;
  return { tournament,games,teams,matches:matches||[],demo:false };
}

export function applyRealtimeChange(bundle,payload){
  if(!bundle||!payload) return bundle;
  const table=payload.table;
  if(table==='matches'){
    const row=payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    if(payload.eventType==='DELETE') bundle.matches=bundle.matches.filter(x=>x.id!==row.id);
    else {
      const i=bundle.matches.findIndex(x=>x.id===row.id);
      if(i>=0) bundle.matches[i]={...bundle.matches[i],...row}; else bundle.matches.push(row);
      bundle.matches.sort((a,b)=>new Date(a.scheduled_at||0)-new Date(b.scheduled_at||0));
    }
  } else if(table==='teams'){
    const row=payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
    if(payload.eventType==='DELETE') bundle.teams=bundle.teams.filter(x=>x.id!==row.id);
    else { const i=bundle.teams.findIndex(x=>x.id===row.id); if(i>=0) bundle.teams[i]={...bundle.teams[i],...row}; else bundle.teams.push(row); }
    bundle.teams.sort((a,b)=>(a.seed_order||999)-(b.seed_order||999));
    clearStaticCache();
  }
  return bundle;
}

export function subscribeTournament(tournamentId, onChange) {
  if (!isConfigured()) return { unsubscribe(){} };
  const channel = supabase.channel(`scoreboard:${tournamentId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'matches',filter:`tournament_id=eq.${tournamentId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'teams',filter:`tournament_id=eq.${tournamentId}`},onChange)
    .subscribe();
  return { unsubscribe(){ supabase.removeChannel(channel); } };
}

export async function requireEditor() {
  if (!isConfigured()) return { demo:true,user:{email:'demo@local'} };
  const { data:{user}, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data:profile, error:pErr } = await supabase.from('profiles').select('user_id,display_name,role').eq('user_id',user.id).maybeSingle();
  if (pErr) throw pErr;
  if (!profile || !['admin','marshal'].includes(profile.role)) return { user, profile, forbidden:true };
  return { user, profile };
}

export const columns={TOURNAMENT_COLUMNS,GAME_COLUMNS,TEAM_COLUMNS,MATCH_COLUMNS};
