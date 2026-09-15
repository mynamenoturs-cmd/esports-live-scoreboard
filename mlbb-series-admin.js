import { supabase, isConfigured } from './supabase-client.js';
import { loadTournamentBundle, gameMap, teamMap, maxWins } from './data.js';

const $=s=>document.querySelector(s);
let root=null,activeId='',rows=[],renderSeq=0,refreshTimer=null;
try{activeId=sessionStorage.getItem('mlbb-active-match')||''}catch{}

function notify(text,type='success'){
  const el=$('#admin-message');if(!el)return;
  el.textContent=text;el.className=`notice ${type==='error'?'error':type==='success'?'success':''} section`;el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),6000);
}
function pipHtml(wins,target,side){
  const out=[];for(let i=0;i<target;i++)out.push(`<span class="series-pip ${i<wins?'on':''}"></span>`);
  return `<span class="series-pips ${side}" aria-label="${wins} daripada ${target} kemenangan game">${out.join('')}</span>`;
}
function currentFilter(){return $('#admin-game-filter')?.value||'all'}
function gameFor(match){return root?.games?.find(g=>g.id===match?.game_id)}
function chooseDefault(){
  if(!root)return null;
  const gm=gameMap(root.games),filter=currentFilter();
  const candidates=(root.matches||[]).filter(m=>(m.team_a_id||m.team_b_id)&&(filter==='all'||gm[m.game_id]?.code===filter));
  let m=(activeId&&candidates.find(x=>x.id===activeId))||candidates.find(x=>x.status==='live')||candidates.find(x=>x.status==='scheduled'&&x.team_a_id&&x.team_b_id)||candidates[0]||null;
  if(m){activeId=m.id;try{sessionStorage.setItem('mlbb-active-match',activeId)}catch{}}
  return m;
}
async function reloadRoot(){
  if(!isConfigured())return;
  root=await loadTournamentBundle({forceStatic:true,preferEdge:false});
}
async function loadGames(matchId){
  if(!matchId||!supabase)return [];
  const {data,error}=await supabase.from('match_games').select('id,match_id,game_number,team_a_points,team_b_points,winner_id,notes,created_at').eq('match_id',matchId).order('game_number',{ascending:true});
  if(error)throw error;return data||[];
}
function derived(match,list=rows){
  let a=0,b=0;for(const g of list){if(g.winner_id===match.team_a_id)a++;else if(g.winner_id===match.team_b_id)b++}
  if(!list.length){a=Number(match.team_a_score||0);b=Number(match.team_b_score||0)}
  return {a,b};
}
function ensurePanel(){
  const box=$('#control-box');if(!box)return null;
  let panel=$('#mlbb-series-control');
  if(!panel){panel=document.createElement('div');panel.id='mlbb-series-control';panel.className='mlbb-series-control hidden';const score=box.querySelector('.admin-score');score?.insertAdjacentElement('afterend',panel)}
  return panel;
}
function historyHtml(match,list,tm){
  if(!list.length)return '<div class="subtle small" style="text-align:center;margin-top:10px">Belum ada game direkod.</div>';
  return `<div class="mlbb-game-history">${list.map(g=>{const w=g.winner_id===match.team_a_id?tm[match.team_a_id]?.name:g.winner_id===match.team_b_id?tm[match.team_b_id]?.name:'—';return `<div class="mlbb-game-row"><span class="chip">G${g.game_number}</span><span><span class="winner">${w||'—'} menang</span><span class="kills"> · Kill ${Number(g.team_a_points||0)}–${Number(g.team_b_points||0)}</span></span><span class="chip finished">✓</span></div>`}).join('')}</div>`;
}
async function render(){
  if(!root)await reloadRoot();
  const match=chooseDefault(),panel=ensurePanel(),numeric=$('#control-box .admin-score');
  if(!match||!panel)return;
  const game=gameFor(match),isSeries=game?.scoring_mode==='series';
  if(numeric)numeric.style.display=isSeries?'none':'';
  panel.classList.toggle('hidden',!isSeries);
  if(!isSeries)return;
  const seq=++renderSeq;
  try{rows=await loadGames(match.id)}catch(e){notify(e.message,'error');return}
  if(seq!==renderSeq)return;
  const tm=teamMap(root.teams),score=derived(match,rows),target=maxWins(match.best_of||1),nextNo=(rows.reduce((n,g)=>Math.max(n,Number(g.game_number||0)),0)+1),ready=Math.max(score.a,score.b)>=target;
  const aName=tm[match.team_a_id]?.name||'TEAM A',bName=tm[match.team_b_id]?.name||'TEAM B';
  panel.innerHTML=`
    <div class="mlbb-series-title"><div><div class="eyebrow">MLBB Series Control</div><strong>Game Win · bukan skor kill</strong></div><span class="chip">BO${match.best_of||1} · FIRST TO ${target}</span></div>
    <div class="mlbb-series-scoreboard">
      <div class="mlbb-series-team a"><div class="mlbb-series-name">${aName}</div>${pipHtml(score.a,target,'a')}</div>
      <div class="mlbb-series-vs">VS</div>
      <div class="mlbb-series-team b"><div class="mlbb-series-name">${bName}</div>${pipHtml(score.b,target,'b')}</div>
    </div>
    ${ready?`<div class="mlbb-series-ready">✓ ${score.a>score.b?aName:bName} sudah cukup kemenangan game · tekan Tamat Perlawanan</div>`:`
    <div class="mlbb-game-entry">
      <div class="field"><label>Game ${nextNo} · Kill ${aName}</label><input id="mlbb-kill-a" type="number" inputmode="numeric" min="0" value="0"></div>
      <div class="field"><label>Game ${nextNo} · Kill ${bName}</label><input id="mlbb-kill-b" type="number" inputmode="numeric" min="0" value="0"></div>
      <div class="span-2 mlbb-winner-actions"><button type="button" class="btn primary" data-mlbb-winner="a">◆ ${aName} MENANG GAME ${nextNo}</button><button type="button" class="btn magenta" data-mlbb-winner="b">◆ ${bName} MENANG GAME ${nextNo}</button></div>
    </div>`}
    ${historyHtml(match,rows,tm)}
    ${rows.length?'<div class="actions" style="justify-content:center;margin-top:12px"><button type="button" class="btn danger small" id="mlbb-undo-game">Undo Game Terakhir</button></div>':''}
    <div class="subtle small" style="text-align:center;margin-top:10px">Kill direkod sebagai statistik sahaja. Pemenang game dipilih berasingan dan menentukan lampu kemenangan siri.</div>`;
}
async function syncSeriesScore(match,list){
  const score=derived(match,list);
  const {error}=await supabase.from('matches').update({team_a_score:score.a,team_b_score:score.b}).eq('id',match.id);if(error)throw error;
  match.team_a_score=score.a;match.team_b_score=score.b;return score;
}
async function recordWinner(side){
  const match=chooseDefault();if(!match||gameFor(match)?.scoring_mode!=='series')return;
  rows=await loadGames(match.id);const score=derived(match,rows),target=maxWins(match.best_of||1);if(Math.max(score.a,score.b)>=target)return notify('Siri sudah mempunyai pemenang. Tamatkan perlawanan atau undo game terakhir.','error');
  const gameNo=rows.reduce((n,g)=>Math.max(n,Number(g.game_number||0)),0)+1;
  const killsA=Math.max(0,Number($('#mlbb-kill-a')?.value||0)),killsB=Math.max(0,Number($('#mlbb-kill-b')?.value||0));
  const winner_id=side==='a'?match.team_a_id:match.team_b_id;if(!winner_id)return notify('Pasukan untuk game ini belum lengkap.','error');
  const {error}=await supabase.from('match_games').insert({match_id:match.id,game_number:gameNo,team_a_points:killsA,team_b_points:killsB,winner_id});if(error)return notify(error.message,'error');
  rows=await loadGames(match.id);await syncSeriesScore(match,rows);notify(`Game ${gameNo} direkod. Kill ${killsA}-${killsB}; pemenang ditentukan berasingan.`,'success');await render();
}
async function undoGame(){
  const match=chooseDefault();if(!match)return;rows=await loadGames(match.id);const last=rows[rows.length-1];if(!last)return;
  if(!confirm(`Undo keputusan Game ${last.game_number}?`))return;
  const {error}=await supabase.from('match_games').delete().eq('id',last.id);if(error)return notify(error.message,'error');
  rows=await loadGames(match.id);await syncSeriesScore(match,rows);notify('Game terakhir dibuang.','success');await render();
}
async function resetSeries(match){
  if(!confirm('Reset keseluruhan siri MLBB ini? Semua keputusan game dan statistik kill untuk match ini akan dipadam.'))return;
  if(match.next_match_id&&match.next_match_slot){const next=root.matches.find(m=>m.id===match.next_match_id);if(next&&['live','finished'].includes(next.status)&&!confirm('Match seterusnya sudah LIVE/SELESAI. Reset boleh mengganggu bracket. Teruskan?'))return;const field=match.next_match_slot==='a'?'team_a_id':'team_b_id';const r=await supabase.from('matches').update({[field]:null}).eq('id',match.next_match_id);if(r.error)return notify(r.error.message,'error')}
  let r=await supabase.from('match_games').delete().eq('match_id',match.id);if(r.error)return notify(r.error.message,'error');
  r=await supabase.from('matches').update({team_a_score:0,team_b_score:0,team_a_tiebreak:null,team_b_tiebreak:null,winner_id:null,status:'scheduled',finished_at:null}).eq('id',match.id);if(r.error)return notify(r.error.message,'error');
  notify('Siri MLBB direset.','success');setTimeout(()=>location.reload(),450);
}
async function finishSeries(match){
  rows=await loadGames(match.id);const score=derived(match,rows),target=maxWins(match.best_of||1);
  if(score.a===score.b)return notify('Belum ada pemenang siri MLBB.','error');
  if(Math.max(score.a,score.b)<target&&!confirm(`BO${match.best_of||1} memerlukan ${target} kemenangan game. Tamatkan juga?`))return;
  await syncSeriesScore(match,rows);const {error}=await supabase.rpc('finish_match',{p_match_id:match.id});if(error)return notify(error.message,'error');
  notify('Siri MLBB tamat. Pemenang disahkan dan bracket dikemas kini.','success');setTimeout(()=>location.reload(),500);
}
function scheduleRender(){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{try{await reloadRoot();await render()}catch{}},160)}
function bind(){
  ensurePanel();scheduleRender();
  document.addEventListener('click',e=>{
    const control=e.target.closest('[data-control]');if(control){activeId=control.dataset.control;try{sessionStorage.setItem('mlbb-active-match',activeId)}catch{}setTimeout(scheduleRender,80);return}
    const win=e.target.closest('[data-mlbb-winner]');if(win){recordWinner(win.dataset.mlbbWinner);return}
    if(e.target.closest('#mlbb-undo-game')){undoGame();return}
  });
  document.addEventListener('click',e=>{
    const match=chooseDefault();if(!match||gameFor(match)?.scoring_mode!=='series')return;
    if(e.target.closest('#reset')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();resetSeries(match);return}
    if(e.target.closest('#finish')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();finishSeries(match);return}
  },true);
  $('#admin-game-filter')?.addEventListener('change',()=>{activeId='';scheduleRender()});
  const box=$('#control-box');if(box)new MutationObserver(()=>{if(!box.classList.contains('hidden'))scheduleRender()}).observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
