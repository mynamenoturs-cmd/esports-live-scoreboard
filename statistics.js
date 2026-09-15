import { supabase, isConfigured } from './supabase-client.js';

let bundle=null,rows=[],channel=null,loading=false;
const $=s=>document.querySelector(s);
const esc=(s='')=>String(s).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const initials=(name='TEAM')=>String(name).trim().split(/\s+/).map(x=>x[0]||'').join('').slice(0,3).toUpperCase()||'TM';

function safeLogo(value){
  const raw=String(value||'').trim();if(!raw)return '';
  try{const u=new URL(raw,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}
}
function teamLogo(team){
  const src=safeLogo(team?.logo_url),fallback=esc(team?.short_name||initials(team?.name));
  return `<span class="stats-team-logo${src?' has-logo':''}">${src?`<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-logo')">`:''}<span>${fallback}</span></span>`;
}
function teamById(id){return bundle?.teams?.find(t=>t.id===id)||null}
function matchById(id){return bundle?.matches?.find(m=>m.id===id)||null}
function officialRows(){
  return rows.filter(row=>{
    const match=matchById(row.match_id);if(!match?.started_at)return false;
    const started=new Date(match.started_at).getTime(),created=new Date(row.created_at||0).getTime();
    if(!Number.isFinite(started)||!Number.isFinite(created))return false;
    return created>=started;
  });
}
function grouped(source=officialRows()){
  const map=new Map();
  for(const row of source){if(!map.has(row.match_id))map.set(row.match_id,[]);map.get(row.match_id).push(row)}
  return [...map.entries()].map(([matchId,games])=>{
    games.sort((a,b)=>Number(a.game_number||0)-Number(b.game_number||0));
    return {match:matchById(matchId),games};
  }).filter(x=>x.match).sort((a,b)=>{
    const ta=Math.max(...a.games.map(g=>new Date(g.created_at||0).getTime()),0);
    const tb=Math.max(...b.games.map(g=>new Date(g.created_at||0).getTime()),0);
    return tb-ta;
  });
}
function summary(match,games){
  let winA=0,winB=0,killA=0,killB=0;
  for(const g of games){
    if(g.winner_id===match.team_a_id)winA++;
    if(g.winner_id===match.team_b_id)winB++;
    killA+=Number(g.team_a_points||0);killB+=Number(g.team_b_points||0);
  }
  const latest=games.at(-1)||null;
  return {winA,winB,killA,killB,latest};
}
function gameRow(match,g){
  const a=teamById(match.team_a_id),b=teamById(match.team_b_id),winner=teamById(g.winner_id);
  const kda=`${Number(g.mvp_kills||0)}/${Number(g.mvp_deaths||0)}/${Number(g.mvp_assists||0)}`;
  return `<div class="stats-game-row"><span class="stats-game-no">G${Number(g.game_number||1)}</span><span><b>${esc(winner?.name||'—')}</b> menang</span><span>Kill ${Number(g.team_a_points||0)}–${Number(g.team_b_points||0)}</span><span>MVP ${esc(g.mvp_name||'—')} · KDA ${esc(kda)}</span><span class="stats-game-teams">${esc(a?.short_name||a?.name||'A')} vs ${esc(b?.short_name||b?.name||'B')}</span></div>`;
}
function card({match,games}){
  const a=teamById(match.team_a_id),b=teamById(match.team_b_id),s=summary(match,games),latest=s.latest;
  const kda=latest?`${Number(latest.mvp_kills||0)}/${Number(latest.mvp_deaths||0)}/${Number(latest.mvp_assists||0)}`:'—';
  return `<article class="stats-match-card">
    <div class="stats-match-head"><div><small>${esc(match.round_name||match.stage||'Perlawanan')}</small><strong>Station ${esc(match.station||'1')} · BO${Number(match.best_of||1)}</strong></div><span class="chip ${match.status==='finished'?'finished':match.status==='live'?'live':''}">${esc((match.status||'scheduled').toUpperCase())}</span></div>
    <div class="stats-versus">
      <div class="stats-side a">${teamLogo(a)}<div><strong>${esc(a?.name||'TBD')}</strong><small>${s.winA} GAME WIN</small></div></div>
      <div class="stats-series-score"><small>GAME WIN</small><strong>${s.winA}<em>–</em>${s.winB}</strong><span>TOTAL KILL ${s.killA}<em>–</em>${s.killB}</span></div>
      <div class="stats-side b"><div><strong>${esc(b?.name||'TBD')}</strong><small>${s.winB} GAME WIN</small></div>${teamLogo(b)}</div>
    </div>
    <div class="stats-highlight"><div><small>MVP TERKINI</small><strong>${esc(latest?.mvp_name||'—')}</strong></div><div><small>KDA</small><strong>${esc(kda)}</strong></div><div><small>GAME DIREKOD</small><strong>${games.length}</strong></div></div>
    <details class="stats-details"><summary>Butiran setiap game</summary><div class="stats-game-list">${games.map(g=>gameRow(match,g)).join('')}</div></details>
  </article>`;
}
function topMvp(source){
  const counts=new Map();for(const r of source){const n=String(r.mvp_name||'').trim();if(n)counts.set(n,(counts.get(n)||0)+1)}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
}
function paint(){
  const host=$('#statistics');if(!host)return;
  const official=officialRows(),groups=grouped(official);
  if(!groups.length){host.innerHTML='<div class="notice">Belum ada statistik rasmi. Statistik hanya mula dikira selepas marshal menekan START LIVE.</div>';return}
  const totalGames=official.length,totalKills=official.reduce((n,r)=>n+Number(r.team_a_points||0)+Number(r.team_b_points||0),0),mvp=topMvp(official);
  host.innerHTML=`<div class="stats-overview"><div><small>PERLAWANAN DIREKOD</small><strong>${groups.length}</strong></div><div><small>GAME OFFICIAL</small><strong>${totalGames}</strong></div><div><small>TOTAL KILL KEJOHANAN</small><strong>${totalKills}</strong></div><div><small>TOP MVP</small><strong>${esc(mvp?.[0]||'—')}</strong><span>${mvp?`${mvp[1]}× MVP`:'Belum ada'}</span></div></div><div class="stats-match-list">${groups.map(card).join('')}</div>`;
}
async function loadRows(){
  if(loading||!bundle||!isConfigured()||!supabase)return;
  const ids=(bundle.matches||[]).map(m=>m.id).filter(Boolean);if(!ids.length){rows=[];paint();return}
  loading=true;
  try{
    const {data,error}=await supabase.from('match_games').select('match_id,game_number,team_a_points,team_b_points,winner_id,mvp_name,mvp_kills,mvp_deaths,mvp_assists,created_at').in('match_id',ids).order('game_number',{ascending:true});
    if(error)throw error;rows=data||[];paint();
  }catch(e){const host=$('#statistics');if(host)host.innerHTML=`<div class="notice error">Statistik gagal dimuatkan: ${esc(e.message)}</div>`}
  finally{loading=false}
}
function applyRealtime(payload){
  const row=payload.new&&Object.keys(payload.new).length?payload.new:payload.old;if(!row?.match_id)return;
  const allowed=new Set((bundle?.matches||[]).map(m=>m.id));if(!allowed.has(row.match_id))return;
  const key=x=>`${x.match_id}:${x.game_number}`;
  const k=key(row),idx=rows.findIndex(x=>key(x)===k);
  if(payload.eventType==='DELETE'){if(idx>=0)rows.splice(idx,1)}
  else if(idx>=0)rows[idx]={...rows[idx],...row};else rows.push(row);
  paint();
}
function bindRealtime(){
  if(channel||!isConfigured()||!supabase)return;
  channel=supabase.channel('dashboard-mlbb-statistics').on('postgres_changes',{event:'*',schema:'public',table:'match_games'},applyRealtime).subscribe();
}
function acceptBundle(next){
  if(!next?.activeGame||next.activeGame.code!=='mlbb')return;
  bundle=next;loadRows();bindRealtime();paint();
}
window.addEventListener('pesmac-dashboard-data',e=>acceptBundle(e.detail));
window.addEventListener('beforeunload',()=>{if(channel&&supabase)supabase.removeChannel(channel)});
if(window.__PESMAC_DASHBOARD__)acceptBundle(window.__PESMAC_DASHBOARD__);