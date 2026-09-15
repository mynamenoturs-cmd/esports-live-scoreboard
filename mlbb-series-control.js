import { supabase, isConfigured } from './supabase-client.js';
import { loadTournamentBundle, gameMap, teamMap, maxWins } from './data.js';

const $=s=>document.querySelector(s);
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let root=null,activeId='',games=[],roster=[];
try{activeId=sessionStorage.getItem('mlbb-active-match')||''}catch{}

const notice=(text,type='success')=>{const el=$('#admin-message');if(!el)return;el.textContent=text;el.className=`notice ${type==='error'?'error':type==='success'?'success':''} section`;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),6000)};
const pips=(wins,target,side)=>`<span class="series-pips ${side}">${Array.from({length:target},(_,i)=>`<span class="series-pip ${i<wins?'on':''}"></span>`).join('')}</span>`;
const gameFor=m=>root?.games?.find(g=>g.id===m?.game_id);
const filterCode=()=>$('#admin-game-filter')?.value||'all';

async function loadRoot(){if(!isConfigured())return;root=await loadTournamentBundle({forceStatic:true,preferEdge:false})}
function selectMatch(){
  if(!root)return null;const gm=gameMap(root.games),code=filterCode();
  const list=(root.matches||[]).filter(m=>(m.team_a_id||m.team_b_id)&&(code==='all'||gm[m.game_id]?.code===code));
  const m=(activeId&&list.find(x=>x.id===activeId))||list.find(x=>x.status==='live')||list.find(x=>x.status==='scheduled'&&x.team_a_id&&x.team_b_id)||list[0]||null;
  if(m){activeId=m.id;try{sessionStorage.setItem('mlbb-active-match',activeId)}catch{}}
  return m;
}
async function loadGames(id){const {data,error}=await supabase.from('match_games').select('id,game_number,team_a_points,team_b_points,winner_id,mvp_player_id,mvp_name,mvp_kills,mvp_deaths,mvp_assists').eq('match_id',id).order('game_number');if(error)throw error;return data||[]}
async function loadRoster(m){
  if(!m?.team_a_id&&!m?.team_b_id)return [];
  const ids=[m.team_a_id,m.team_b_id].filter(Boolean);
  const {data,error}=await supabase.from('players').select('id,team_id,gamer_tag,real_name').in('team_id',ids).order('sort_order',{ascending:true});
  if(error)throw error;return data||[];
}
function scoreFor(m,rows){let a=0,b=0;for(const r of rows){if(r.winner_id===m.team_a_id)a++;if(r.winner_id===m.team_b_id)b++}return {a,b}}
function ensurePanel(){const box=$('#control-box');if(!box)return null;let p=$('#mlbb-series-control');if(!p){p=document.createElement('div');p.id='mlbb-series-control';p.className='mlbb-series-control hidden';box.querySelector('.admin-score')?.insertAdjacentElement('afterend',p)}return p}
function rosterOptions(){return roster.map(p=>`<option value="${esc(p.gamer_tag)}">${esc(p.gamer_tag)}${p.real_name?` · ${esc(p.real_name)}`:''}</option>`).join('')}

async function paint(){
  await loadRoot();const m=selectMatch(),panel=ensurePanel(),numeric=$('#control-box .admin-score');if(!m||!panel)return;
  const series=gameFor(m)?.scoring_mode==='series';if(numeric)numeric.style.display=series?'none':'';panel.classList.toggle('hidden',!series);if(!series)return;
  [games,roster]=await Promise.all([loadGames(m.id),loadRoster(m)]);const tm=teamMap(root.teams),s=scoreFor(m,games),target=maxWins(m.best_of||1),ready=Math.max(s.a,s.b)>=target;
  const a=tm[m.team_a_id]?.name||'TEAM A',b=tm[m.team_b_id]?.name||'TEAM B',next=(games.at(-1)?.game_number||0)+1;
  panel.innerHTML=`<div class="mlbb-series-title"><div><div class="eyebrow">MLBB Series Control</div><strong>Game Win · kill bukan penentu kemenangan</strong></div><span class="chip">BO${m.best_of||1} · FIRST TO ${target}</span></div>
  <div class="mlbb-series-scoreboard"><div class="mlbb-series-team a"><div class="mlbb-series-name">${esc(a)}</div>${pips(s.a,target,'a')}</div><div class="mlbb-series-vs">VS</div><div class="mlbb-series-team b"><div class="mlbb-series-name">${esc(b)}</div>${pips(s.b,target,'b')}</div></div>
  ${ready?`<div class="mlbb-series-ready">✓ ${esc(s.a>s.b?a:b)} cukup kemenangan game · tekan Tamat Perlawanan</div>`:`<div class="mlbb-game-entry">
    <div class="field"><label>Game ${next} · Kill ${esc(a)}</label><input id="mlbb-kill-a" type="number" min="0" inputmode="numeric" value="0"></div>
    <div class="field"><label>Game ${next} · Kill ${esc(b)}</label><input id="mlbb-kill-b" type="number" min="0" inputmode="numeric" value="0"></div>
    <div class="field span-2"><label>MVP Game ${next}</label><input id="mlbb-mvp-name" type="text" list="mlbb-player-list" autocomplete="off" placeholder="Pilih / taip gamer tag MVP" required><datalist id="mlbb-player-list">${rosterOptions()}</datalist></div>
    <div class="mlbb-kda-grid span-2"><div class="field"><label>MVP Kill (K)</label><input id="mlbb-mvp-k" type="number" min="0" inputmode="numeric" placeholder="0"></div><div class="field"><label>MVP Death (D)</label><input id="mlbb-mvp-d" type="number" min="0" inputmode="numeric" placeholder="0"></div><div class="field"><label>MVP Assist (A)</label><input id="mlbb-mvp-a" type="number" min="0" inputmode="numeric" placeholder="0"></div></div>
    <div class="span-2 mlbb-winner-actions"><button type="button" class="btn primary" data-mlbb-win="a">◆ ${esc(a)} MENANG GAME ${next}</button><button type="button" class="btn magenta" data-mlbb-win="b">◆ ${esc(b)} MENANG GAME ${next}</button></div>
  </div>`}
  ${games.length?`<div class="mlbb-game-history">${games.map(g=>`<div class="mlbb-game-row"><span class="chip">G${g.game_number}</span><span><span class="winner">${esc(g.winner_id===m.team_a_id?a:b)} menang</span><span class="kills"> · Kill ${g.team_a_points||0}–${g.team_b_points||0}</span><span class="mlbb-history-mvp">MVP ${esc(g.mvp_name||'—')} · KDA ${g.mvp_kills??'—'}/${g.mvp_deaths??'—'}/${g.mvp_assists??'—'}</span></span><span class="chip finished">✓</span></div>`).join('')}</div><div class="actions" style="justify-content:center;margin-top:12px"><button id="mlbb-undo" type="button" class="btn danger small">Undo Game Terakhir</button></div>`:''}
  <div class="subtle small" style="text-align:center;margin-top:10px">Lampu ◆ menunjukkan kemenangan game. Kill dan KDA ialah statistik; MVP wajib diisi sebelum keputusan game disahkan.</div>`;
}
async function syncMatch(m){games=await loadGames(m.id);const s=scoreFor(m,games);const {error}=await supabase.from('matches').update({team_a_score:s.a,team_b_score:s.b}).eq('id',m.id);if(error)throw error;return s}
async function addGame(side){
  const m=selectMatch();if(!m||gameFor(m)?.scoring_mode!=='series')return;games=await loadGames(m.id);const s=scoreFor(m,games),target=maxWins(m.best_of||1);if(Math.max(s.a,s.b)>=target)return notice('Siri sudah mempunyai pemenang.','error');
  const n=(games.at(-1)?.game_number||0)+1,winner_id=side==='a'?m.team_a_id:m.team_b_id,kA=Math.max(0,Number($('#mlbb-kill-a')?.value||0)),kB=Math.max(0,Number($('#mlbb-kill-b')?.value||0));
  const mvpName=($('#mlbb-mvp-name')?.value||'').trim();const kRaw=$('#mlbb-mvp-k')?.value,dRaw=$('#mlbb-mvp-d')?.value,aRaw=$('#mlbb-mvp-a')?.value;
  if(!mvpName)return notice('Masukkan nama / gamer tag MVP sebelum sahkan pemenang game.','error');
  if(kRaw===''||dRaw===''||aRaw==='')return notice('Lengkapkan K / D / A MVP sebelum sahkan pemenang game.','error');
  const mvp=roster.find(p=>String(p.gamer_tag).toLowerCase()===mvpName.toLowerCase());
  if(mvp&&mvp.team_id!==winner_id&&!confirm(`${mvpName} bukan daripada pasukan yang dipilih menang. Simpan juga?`))return;
  const payload={match_id:m.id,game_number:n,team_a_points:kA,team_b_points:kB,winner_id,mvp_player_id:mvp?.id||null,mvp_name:mvpName,mvp_kills:Math.max(0,Number(kRaw)),mvp_deaths:Math.max(0,Number(dRaw)),mvp_assists:Math.max(0,Number(aRaw))};
  const {error}=await supabase.from('match_games').insert(payload);if(error)return notice(error.message,'error');await syncMatch(m);notice(`Game ${n} disahkan · MVP ${mvpName} · KDA ${payload.mvp_kills}/${payload.mvp_deaths}/${payload.mvp_assists}.`);await paint();
}
async function undo(){const m=selectMatch();if(!m)return;games=await loadGames(m.id);const last=games.at(-1);if(!last)return;if(!confirm(`Undo Game ${last.game_number}?`))return;const {error}=await supabase.from('match_games').delete().eq('id',last.id);if(error)return notice(error.message,'error');await syncMatch(m);notice('Game terakhir dibuang.');await paint()}
async function finish(m){games=await loadGames(m.id);const s=scoreFor(m,games),target=maxWins(m.best_of||1);if(s.a===s.b)return notice('Belum ada pemenang siri.','error');if(Math.max(s.a,s.b)<target&&!confirm(`BO${m.best_of||1} memerlukan ${target} kemenangan. Tamatkan juga?`))return;await syncMatch(m);const {error}=await supabase.rpc('finish_match',{p_match_id:m.id});if(error)return notice(error.message,'error');notice('Siri MLBB tamat. Pemenang disahkan.');setTimeout(()=>location.reload(),450)}
async function reset(m){if(!confirm('Reset siri MLBB ini? Semua keputusan game, MVP dan statistik kill/KDA untuk match ini akan dipadam.'))return;if(m.next_match_id&&m.next_match_slot){const next=root.matches.find(x=>x.id===m.next_match_id);if(next&&['live','finished'].includes(next.status)&&!confirm('Match seterusnya sudah LIVE/SELESAI. Teruskan reset?'))return;const field=m.next_match_slot==='a'?'team_a_id':'team_b_id';const r=await supabase.from('matches').update({[field]:null}).eq('id',m.next_match_id);if(r.error)return notice(r.error.message,'error')}let r=await supabase.from('match_games').delete().eq('match_id',m.id);if(r.error)return notice(r.error.message,'error');r=await supabase.from('matches').update({team_a_score:0,team_b_score:0,team_a_tiebreak:null,team_b_tiebreak:null,winner_id:null,status:'scheduled',finished_at:null}).eq('id',m.id);if(r.error)return notice(r.error.message,'error');notice('Siri MLBB direset.');setTimeout(()=>location.reload(),450)}

function bind(){
  ensurePanel();setTimeout(()=>paint().catch(()=>{}),250);
  document.addEventListener('click',e=>{const c=e.target.closest('[data-control]');if(c){activeId=c.dataset.control;try{sessionStorage.setItem('mlbb-active-match',activeId)}catch{}setTimeout(()=>paint().catch(()=>{}),100);return}const w=e.target.closest('[data-mlbb-win]');if(w){addGame(w.dataset.mlbbWin);return}if(e.target.closest('#mlbb-undo')){undo();return}});
  document.addEventListener('click',e=>{const m=selectMatch();if(!m||gameFor(m)?.scoring_mode!=='series')return;if(e.target.closest('#finish')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();finish(m)}else if(e.target.closest('#reset')){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();reset(m)}},true);
  $('#admin-game-filter')?.addEventListener('change',()=>{activeId='';setTimeout(()=>paint().catch(()=>{}),100)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();