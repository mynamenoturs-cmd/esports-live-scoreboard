import { supabase, isConfigured } from './supabase-client.js';

const cache=new Map();
let timer=null,channel=null;
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const sig=row=>[row?.game_number,row?.team_a_points,row?.team_b_points,row?.winner_id,row?.mvp_name,row?.mvp_kills,row?.mvp_deaths,row?.mvp_assists].join('|');

async function latest(matchId,force=false){
  if(!isConfigured()||!supabase||!matchId)return null;
  if(!force&&cache.has(matchId))return cache.get(matchId);
  const {data,error}=await supabase.from('match_games').select('match_id,game_number,team_a_points,team_b_points,winner_id,mvp_name,mvp_kills,mvp_deaths,mvp_assists,created_at').eq('match_id',matchId).order('game_number',{ascending:false}).limit(1).maybeSingle();
  if(error)return null;cache.set(matchId,data||null);return data||null;
}
function winnerInfo(card,row){
  const side=row.winner_id===card.dataset.teamAId?'a':row.winner_id===card.dataset.teamBId?'b':'';
  if(!side)return {name:'Pemenang',logo:''};
  const el=side==='a'?card.querySelector('.team-side:not(.right)'):card.querySelector('.team-side.right');
  return {name:el?.querySelector('.team-name')?.textContent?.trim()||'Pemenang',logo:el?.querySelector('.team-logo')?.outerHTML||''};
}
function resultHtml(card,row){
  const w=winnerInfo(card,row),kda=`${row.mvp_kills??'—'} / ${row.mvp_deaths??'—'} / ${row.mvp_assists??'—'}`,signature=esc(sig(row));
  return `<section class="mlbb-live-result" data-result-for="${esc(row.match_id)}" data-result-signature="${signature}">
    <div class="mlbb-live-result-head"><span>GAME ${row.game_number} RESULT</span><span class="chip finished">✓ OFFICIAL</span></div>
    <div class="mlbb-live-result-main"><div class="mlbb-result-winner">${w.logo}<div><small>GAME WINNER</small><strong>${esc(w.name)}</strong></div></div><div class="mlbb-result-kills"><small>TOTAL KILL</small><strong>${Number(row.team_a_points||0)} <span>—</span> ${Number(row.team_b_points||0)}</strong></div><div class="mlbb-result-mvp"><small>MVP</small><strong>${esc(row.mvp_name||'—')}</strong><span>KDA ${esc(kda)}</span></div></div>
  </section>`;
}
async function decorate(force=false){
  const cards=[...document.querySelectorAll('.live-card[data-live-match-id]')];
  for(const card of cards){
    const id=card.dataset.liveMatchId;if(!id)continue;
    const row=await latest(id,force);const old=document.querySelector(`[data-result-for="${CSS.escape(id)}"]`);
    if(!row){old?.remove();continue}
    if(old?.dataset.resultSignature===sig(row))continue;
    const wrap=document.createElement('div');wrap.innerHTML=resultHtml(card,row);const next=wrap.firstElementChild;
    if(old)old.replaceWith(next);else card.insertAdjacentElement('afterend',next);
  }
}
function schedule(force=false){clearTimeout(timer);timer=setTimeout(()=>decorate(force),90)}
function bind(){
  schedule();
  const host=document.querySelector('#live-panel')||document.querySelector('#live');if(host)new MutationObserver(()=>schedule()).observe(host,{childList:true,subtree:true});
  if(isConfigured()&&supabase){channel=supabase.channel('public-mlbb-game-results').on('postgres_changes',{event:'*',schema:'public',table:'match_games'},payload=>{const row=payload.new&&Object.keys(payload.new).length?payload.new:payload.old;if(row?.match_id)cache.delete(row.match_id);schedule(true)}).subscribe()}
}
window.addEventListener('beforeunload',()=>{if(channel&&supabase)supabase.removeChannel(channel)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();