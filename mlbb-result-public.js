import { supabase, isConfigured } from './supabase-client.js';

const cache=new Map();
let timer=null,channel=null;
const esc=(s='')=>String(s).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const rowSig=row=>[row?.game_number,row?.team_a_points,row?.team_b_points,row?.winner_id,row?.mvp_name,row?.mvp_kills,row?.mvp_deaths,row?.mvp_assists].join('|');

async function rowsFor(matchId,force=false){
  if(!isConfigured()||!supabase||!matchId)return [];
  if(!force&&cache.has(matchId))return cache.get(matchId);
  const {data,error}=await supabase.from('match_games').select('match_id,game_number,team_a_points,team_b_points,winner_id,mvp_name,mvp_kills,mvp_deaths,mvp_assists,created_at').eq('match_id',matchId).order('game_number',{ascending:true});
  if(error)return [];
  const rows=data||[];cache.set(matchId,rows);return rows;
}
function summaryFor(card,rows){
  const teamA=card.dataset.teamAId||'',teamB=card.dataset.teamBId||'';
  let winA=0,winB=0,killA=0,killB=0;
  for(const r of rows){
    if(r.winner_id===teamA)winA++;
    if(r.winner_id===teamB)winB++;
    killA+=Number(r.team_a_points||0);killB+=Number(r.team_b_points||0);
  }
  const latest=rows.at(-1)||null;
  return {winA,winB,killA,killB,latest};
}
function winnerInfo(card,row){
  const side=row.winner_id===card.dataset.teamAId?'a':row.winner_id===card.dataset.teamBId?'b':'';
  if(!side)return {name:'Pemenang',logo:''};
  const el=side==='a'?card.querySelector('.team-side:not(.right)'):card.querySelector('.team-side.right');
  return {name:el?.querySelector('.team-name')?.textContent?.trim()||'Pemenang',logo:el?.querySelector('.team-logo')?.outerHTML||''};
}
function names(card){
  return {
    a:card.querySelector('.team-side:not(.right) .team-name')?.textContent?.trim()||'TEAM A',
    b:card.querySelector('.team-side.right .team-name')?.textContent?.trim()||'TEAM B'
  };
}
function signature(rows,s){return `${rows.map(rowSig).join('~')}|${s.winA}-${s.winB}|${s.killA}-${s.killB}`}
function resultHtml(card,rows){
  const s=summaryFor(card,rows),row=s.latest;if(!row)return '';
  const w=winnerInfo(card,row),n=names(card),kda=`${row.mvp_kills??'—'} / ${row.mvp_deaths??'—'} / ${row.mvp_assists??'—'}`,sig=esc(signature(rows,s));
  return `<section class="mlbb-live-result" data-result-for="${esc(row.match_id)}" data-result-signature="${sig}">
    <div class="mlbb-live-result-head"><span>SERIES LIVE SUMMARY</span><span class="chip finished">✓ GAME ${row.game_number} OFFICIAL</span></div>
    <div class="mlbb-series-summary">
      <div class="series-summary-team a"><small>${esc(n.a)}</small><strong>${s.winA}</strong><span>GAME WIN</span></div>
      <div class="series-summary-center"><small>SERIES</small><strong>${s.winA} <em>—</em> ${s.winB}</strong><span>TOTAL KILL <b>${s.killA} — ${s.killB}</b></span></div>
      <div class="series-summary-team b"><small>${esc(n.b)}</small><strong>${s.winB}</strong><span>GAME WIN</span></div>
    </div>
    <div class="mlbb-live-result-main"><div class="mlbb-result-winner">${w.logo}<div><small>GAME ${row.game_number} WINNER</small><strong>${esc(w.name)}</strong></div></div><div class="mlbb-result-kills"><small>GAME ${row.game_number} KILL</small><strong>${Number(row.team_a_points||0)} <span>—</span> ${Number(row.team_b_points||0)}</strong></div><div class="mlbb-result-mvp"><small>LATEST MVP</small><strong>${esc(row.mvp_name||'—')}</strong><span>KDA ${esc(kda)}</span></div></div>
  </section>`;
}
async function decorate(force=false){
  const cards=[...document.querySelectorAll('.live-card[data-live-match-id]')];
  for(const card of cards){
    const id=card.dataset.liveMatchId;if(!id)continue;
    const rows=await rowsFor(id,force);const old=document.querySelector(`[data-result-for="${CSS.escape(id)}"]`);
    if(!rows.length){old?.remove();continue}
    const s=summaryFor(card,rows),sig=signature(rows,s);
    if(old?.dataset.resultSignature===sig)continue;
    const wrap=document.createElement('div');wrap.innerHTML=resultHtml(card,rows);const next=wrap.firstElementChild;
    if(old)old.replaceWith(next);else card.insertAdjacentElement('afterend',next);
  }
}
function schedule(force=false){clearTimeout(timer);timer=setTimeout(()=>decorate(force),90)}
function emitResult(row,eventType,rows){
  if(typeof window==='undefined'||!row?.match_id||!row?.winner_id)return;
  const card=document.querySelector(`.live-card[data-live-match-id="${CSS.escape(row.match_id)}"]`);
  const s=card?summaryFor(card,rows):{winA:0,winB:0,killA:0,killB:0,latest:row};
  window.dispatchEvent(new CustomEvent('mlbb-game-result',{detail:{...row,eventType,series_win_a:s.winA,series_win_b:s.winB,series_kill_a:s.killA,series_kill_b:s.killB}}));
}
function bind(){
  schedule(true);
  const host=document.querySelector('#live-panel')||document.querySelector('#live');if(host)new MutationObserver(()=>schedule(true)).observe(host,{childList:true,subtree:true});
  if(isConfigured()&&supabase){channel=supabase.channel('public-mlbb-game-results').on('postgres_changes',{event:'*',schema:'public',table:'match_games'},async payload=>{
    const row=payload.new&&Object.keys(payload.new).length?payload.new:payload.old;
    if(row?.match_id)cache.delete(row.match_id);
    const rows=row?.match_id?await rowsFor(row.match_id,true):[];
    schedule(false);
    if(payload.eventType!=='DELETE')emitResult(row,payload.eventType,rows);
  }).subscribe()}
}
window.addEventListener('beforeunload',()=>{if(channel&&supabase)supabase.removeChannel(channel)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();