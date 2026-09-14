import { teamMap, fmtTime, initials } from './data.js';

const esc = (s='') => String(s).replace(/[&<>'"]/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
export const teamName = (m,id,fallback='TBD') => esc(m[id]?.name || fallback);
const formatLabel=(bundle,m)=>bundle.activeGame?.scoring_mode==='goals'?'GOALS':`BO${m.best_of||bundle.activeGame?.default_best_of||1}`;
const stageLabels={group:'Kumpulan',league:'Liga',roundof16:'Pusingan 16',quarterfinal:'Suku Akhir',semifinal:'Separuh Akhir',final:'Grand Final',friendly:'Friendly'};

function safeLogoUrl(value){
  const raw=String(value||'').trim();if(!raw)return '';
  try{const u=new URL(raw,location.origin);return ['http:','https:'].includes(u.protocol)?esc(u.href):''}catch{return ''}
}
function logoBadge(team,className='team-mini-logo',fallback='TM'){
  const text=esc(team?.short_name||initials(team?.name||fallback));
  const src=safeLogoUrl(team?.logo_url);
  return `<span class="${className}${src?' has-logo':''}">${src?`<img src="${src}" alt="" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-logo')">`:''}<span>${text}</span></span>`;
}
function teamInline(team,fallback='TBD'){
  if(!team)return `<span class="team-inline"><span class="team-inline-name">${esc(fallback)}</span></span>`;
  return `<span class="team-inline">${logoBadge(team,'team-mini-logo')}<span class="team-inline-name">${esc(team.name||fallback)}</span></span>`;
}

export function gameTabsHtml(bundle,selectedCode){
  return `<div class="game-tabs">${(bundle.games||[]).filter(g=>g.is_active!==false).sort((a,b)=>(a.sort_order||99)-(b.sort_order||99)).map(g=>`<button class="game-tab ${g.code===selectedCode?'active':''}" data-game="${esc(g.code)}"><span>${esc(g.code.toUpperCase())}</span><small>${esc(g.name)}</small></button>`).join('')}</div>`;
}

export function formatSummaryText(bundle){
  const matches=bundle.matches||[];
  if(matches.some(m=>m.stage==='group'&&m.group_name)){
    const groups=new Set(matches.filter(m=>m.stage==='group'&&m.group_name).map(m=>m.group_name)).size;
    return `${groups} Kumpulan + Knockout`;
  }
  if(matches.some(m=>m.stage==='league')) return 'Liga / Round Robin';
  const first=['roundof16','quarterfinal','semifinal','final'].find(s=>matches.some(m=>m.stage===s));
  if(first) return first==='roundof16'?'Single Elimination · 16-slot':`Single Elimination · ${stageLabels[first]}`;
  return 'Format belum dijana';
}

export function liveMatchHtml(bundle) {
  const tm = teamMap(bundle.teams);
  const live = bundle.matches.find(m=>m.status==='live') || bundle.matches.find(m=>m.status==='scheduled'&&m.team_a_id&&m.team_b_id) || bundle.matches.find(m=>m.team_a_id||m.team_b_id) || bundle.matches[0];
  if (!live) return `<div class="notice">Belum ada perlawanan ${esc(bundle.activeGame?.name||'')}.</div>`;
  const a=tm[live.team_a_id], b=tm[live.team_b_id];
  const isLive=live.status==='live';
  const tb=(live.team_a_tiebreak!=null&&live.team_b_tiebreak!=null)?`<div class="tiebreak">Tie-break / Penalti ${live.team_a_tiebreak} — ${live.team_b_tiebreak}</div>`:'';
  return `
  <div class="live-card">
    <div class="team-side">
      ${logoBadge(a,'team-logo','A')}
      <div><div class="kicker">${esc(bundle.activeGame?.code?.toUpperCase()||'GAME')} · ${esc(live.round_name||'Perlawanan')}</div><div class="team-name">${esc(a?.name||'TBD')}</div></div>
    </div>
    <div class="score-core">
      <span class="status-pill"><span class="status-dot ${isLive?'live':''}"></span>${isLive?'LIVE':esc(live.status?.toUpperCase()||'SCHEDULED')}</span>
      <div class="score"><span class="a">${live.team_a_score??0}</span><span class="score-sep">—</span><span class="b">${live.team_b_score??0}</span></div>
      ${tb}
      <div class="kicker">${formatLabel(bundle,live)} · ${esc(live.round_name||'')}</div>
    </div>
    <div class="team-side right">
      ${logoBadge(b,'team-logo','B')}
      <div><div class="kicker">${esc(bundle.activeGame?.code?.toUpperCase()||'GAME')} · ${esc(live.round_name||'Perlawanan')}</div><div class="team-name">${esc(b?.name||'TBD')}</div></div>
    </div>
  </div>`;
}

function standingsTable(bundle,rows,title='',qualified=0){
  const tm=teamMap(bundle.teams);
  const drawHead=bundle.activeGame?.allow_draws?'<th>Seri</th>':'';
  const drawCell=s=>bundle.activeGame?.allow_draws?`<td>${s.draws||0}</td>`:'';
  return `${title?`<div class="group-standing-title">${esc(title)}</div>`:''}<div class="table-wrap"><table><thead><tr><th>#</th><th>Pasukan</th><th>Main</th><th>Menang</th>${drawHead}<th>Kalah</th><th>Mata</th></tr></thead><tbody>
    ${rows.map((s,i)=>`<tr class="${i<qualified?'highlight':i===0&&!title?'highlight':''}"><td class="pos">${s.position||i+1}</td><td>${teamInline(tm[s.team_id])}${i<qualified?'<span class="qualifier-badge">LAYAK</span>':''}</td><td>${s.played||0}</td><td>${s.wins||0}</td>${drawCell(s)}<td>${s.losses||0}</td><td><strong>${s.points||0}</strong></td></tr>`).join('')}
  </tbody></table></div>`;
}

export function standingsHtml(bundle) {
  const grouped=Object.entries(bundle.groupStandings||{});
  if(grouped.length){
    return `<div class="group-standings">${grouped.map(([label,rows])=>{
      const groupMatches=(bundle.matches||[]).filter(m=>m.stage==='group'&&m.group_name===label);
      const complete=groupMatches.length>0&&groupMatches.every(m=>m.status==='finished');
      const title=`Kumpulan ${label}${complete?' · Rasmi':' · Sementara'}`;
      return `<div class="group-standing-card">${standingsTable(bundle,rows,title,complete?2:0)}</div>`;
    }).join('')}</div>`;
  }
  let rows=(bundle.standings||[]).map((s,i)=>({ ...s,position:s.position||i+1 }));
  if (!rows.length) rows=bundle.teams.map((t,i)=>({team_id:t.id,position:i+1,played:0,wins:0,draws:0,losses:0,points:0}));
  if(!rows.length) return '<div class="notice">Belum ada pasukan untuk game ini.</div>';
  return standingsTable(bundle,rows);
}

export function scheduleHtml(bundle, limit=40) {
  const tm=teamMap(bundle.teams);
  if(!bundle.matches.length) return '<div class="notice">Belum ada jadual perlawanan.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Masa</th><th>Perlawanan</th><th>Peringkat</th><th>Status</th></tr></thead><tbody>
  ${bundle.matches.slice(0,limit).map(m=>`<tr><td>${fmtTime(m.scheduled_at)}</td><td>${teamInline(tm[m.team_a_id])} <span class="subtle">vs</span> ${teamInline(tm[m.team_b_id])}</td><td>${esc(m.round_name||stageLabels[m.stage]||m.stage||'—')}</td><td><span class="chip ${m.status==='live'?'live':m.status==='finished'?'finished':''}">${esc(m.status||'scheduled')}</span></td></tr>`).join('')}
  </tbody></table></div>`;
}

export function teamsHtml(bundle) {
  if(!bundle.teams.length) return '<div class="notice">Belum ada pasukan untuk game ini.</div>';
  return `<div class="team-list">${bundle.teams.map((t,i)=>`<div class="team-row">${logoBadge(t,'team-badge')}<div><strong>${esc(t.name)}</strong><div class="subtle small">No. ${t.seed_order||i+1}</div></div></div>`).join('')}</div>`;
}

export function nextMatchHtml(bundle) {
  const tm=teamMap(bundle.teams);
  const now=Date.now();
  const next=bundle.matches.find(m=>m.status==='scheduled' && m.team_a_id && m.team_b_id && (!m.scheduled_at || new Date(m.scheduled_at).getTime()>=now)) || bundle.matches.find(m=>m.status==='scheduled'&&m.team_a_id&&m.team_b_id);
  if (!next) return `<strong>Perlawanan Seterusnya</strong><span class="subtle">Tiada jadual seterusnya.</span>`;
  return `<strong>Perlawanan Seterusnya · ${esc(bundle.activeGame?.code?.toUpperCase()||'')}</strong><span>${teamInline(tm[next.team_a_id])} <span class="subtle">vs</span> ${teamInline(tm[next.team_b_id])}</span><span class="chip">${fmtTime(next.scheduled_at)} · ${esc(next.round_name||'')}</span>`;
}

function bracketTeam(tm,m,side){
  const id=side==='a'?m.team_a_id:m.team_b_id;
  const score=side==='a'?m.team_a_score:m.team_b_score;
  const winner=m.winner_id===id&&id;
  const team=id?tm[id]:null;
  return `<div class="bracket-team ${winner?'winner':''} ${id?'':'tbd'}"><span class="team-slot">${teamInline(team,'TBD')}${winner?'<span class="qualifier-badge">WIN</span>':''}</span><strong class="bracket-score">${id?(score??0):'—'}</strong></div>`;
}

export function bracketHtml(bundle) {
  const tm=teamMap(bundle.teams);
  const stageOrder=['roundof16','quarterfinal','semifinal','final'];
  const labels={roundof16:'Pusingan 16',quarterfinal:'Suku Akhir',semifinal:'Separuh Akhir',final:'Grand Final'};
  const stages=stageOrder.map(stage=>[stage,bundle.matches.filter(m=>m.stage===stage).sort((a,b)=>(a.bracket_position||99)-(b.bracket_position||99))]).filter(([,ms])=>ms.length);
  if (!stages.length) return `<div class="notice">Belum ada perlawanan knockout untuk ${esc(bundle.activeGame?.name||'game ini')}.</div>`;
  return `<div class="bracket">${stages.map(([stage,ms])=>`<div class="bracket-round" data-stage="${stage}"><div class="bracket-round-head">${labels[stage]} · ${ms.length} match</div><div class="bracket-round-body">${ms.map((m,i)=>`<div class="bracket-match"><div class="bracket-match-label"><span>Match ${m.bracket_position||i+1}</span><span class="bracket-status ${m.status==='live'?'live':m.status==='finished'?'finished':''}">${esc(m.status||'scheduled')}</span></div>${bracketTeam(tm,m,'a')}${bracketTeam(tm,m,'b')}${m.team_a_tiebreak!=null&&m.team_b_tiebreak!=null?`<div class="tiebreak bracket-tiebreak">Tie-break ${m.team_a_tiebreak}-${m.team_b_tiebreak}</div>`:''}</div>`).join('')}</div></div>`).join('')}</div>`;
}
