// Cloudflare Pages Function fallback: read-through cache for public scoreboard data.
const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=5, s-maxage=15, stale-while-revalidate=30',
  'x-content-type-options': 'nosniff'
};
function restHeaders(env){return {apikey:env.SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,accept:'application/json'}}
async function getJson(url,env){const r=await fetch(url,{headers:restHeaders(env)});if(!r.ok)throw new Error(`Supabase ${r.status}`);return r.json()}
export async function onRequestGet({request,env}){
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return new Response(JSON.stringify({error:'Edge cache is not configured'}),{status:503,headers:{'content-type':'application/json'}});
  const reqUrl=new URL(request.url),slug=(reqUrl.searchParams.get('slug')||'').slice(0,80);
  if(!/^[a-z0-9-]+$/i.test(slug))return new Response(JSON.stringify({error:'Invalid slug'}),{status:400,headers:{'content-type':'application/json'}});
  const cache=caches.default,cacheKey=new Request(`${reqUrl.origin}/api/snapshot?slug=${encodeURIComponent(slug)}`,{method:'GET'}),hit=await cache.match(cacheKey);if(hit)return hit;
  const base=env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1';
  const tCols='id,slug,name,venue,starts_at,ends_at,status,updated_at';
  const gameCols='id,tournament_id,code,name,team_size,scoring_mode,default_best_of,allow_draws,sort_order,is_active';
  const teamCols='id,tournament_id,game_id,name,short_name,logo_url,seed_order';
  const matchCols='id,tournament_id,game_id,stage,round_name,group_name,bracket_round,bracket_position,next_match_id,next_match_slot,auto_generated,team_a_id,team_b_id,team_a_score,team_b_score,team_a_tiebreak,team_b_tiebreak,best_of,scheduled_at,station,status,winner_id,started_at,finished_at,updated_at';
  try{
    const tournaments=await getJson(`${base}/tournaments?slug=eq.${encodeURIComponent(slug)}&select=${encodeURIComponent(tCols)}&limit=1`,env),tournament=tournaments?.[0];
    if(!tournament)return new Response(JSON.stringify({error:'Tournament not found'}),{status:404,headers:jsonHeaders});
    const tid=encodeURIComponent(tournament.id);
    const [games,teams,matches]=await Promise.all([
      getJson(`${base}/games?tournament_id=eq.${tid}&select=${encodeURIComponent(gameCols)}&order=sort_order.asc`,env),
      getJson(`${base}/teams?tournament_id=eq.${tid}&select=${encodeURIComponent(teamCols)}&order=seed_order.asc`,env),
      getJson(`${base}/matches?tournament_id=eq.${tid}&select=${encodeURIComponent(matchCols)}&order=scheduled_at.asc.nullslast`,env)
    ]);
    const response=new Response(JSON.stringify({tournament,games,teams,matches,edge_cached_at:new Date().toISOString()}),{headers:jsonHeaders});await cache.put(cacheKey,response.clone());return response;
  }catch{return new Response(JSON.stringify({error:'Snapshot unavailable'}),{status:502,headers:{'content-type':'application/json','cache-control':'no-store'}})}
}
