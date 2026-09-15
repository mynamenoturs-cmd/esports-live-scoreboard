import './mlbb-live-guard.js?v=liveguard1';
import { supabase, isConfigured } from './supabase-client.js';

const $=s=>document.querySelector(s);
let logoRows=new Map();
let activeTeamId='';

function normalizeLogoUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if((raw.startsWith('./')||raw.startsWith('/'))&&!raw.startsWith('//'))return raw;
  try{
    const u=new URL(raw);
    if(!['http:','https:'].includes(u.protocol))return '';
    return u.href;
  }catch{return ''}
}
function displayLogoUrl(value){
  const raw=normalizeLogoUrl(value);if(!raw)return '';
  try{return new URL(raw,location.origin).href}catch{return ''}
}
function initials(name='TEAM'){return String(name).trim().split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase()||'TM'}
function showGlobal(text,type='success'){
  const el=$('#admin-message');if(!el)return;
  el.textContent=text;el.className=`notice ${type==='error'?'error':type==='success'?'success':''} section`;el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),6500);
}
function ensureAddField(){
  const form=$('#team-form');if(!form||$('#team-logo-url'))return;
  const short=$('#team-short')?.closest('.field');
  const field=document.createElement('div');field.className='field span-2';
  field.innerHTML='<label>Logo Pasukan (opsyenal)</label><input id="team-logo-url" type="text" inputmode="url" placeholder="./assets/team-logos/team.png atau https://..."><div class="auto-seed-note">Boleh guna PNG, JPG, WebP atau SVG dari repo sendiri atau URL https. Jika kosong, sistem guna kod ringkas/initial pasukan.</div>';
  short?.insertAdjacentElement('afterend',field);
}
function ensureModal(){
  if($('#team-logo-modal'))return;
  const modal=document.createElement('div');modal.id='team-logo-modal';modal.className='team-logo-modal';
  modal.innerHTML=`<div class="team-logo-dialog" role="dialog" aria-modal="true" aria-label="Logo pasukan">
    <div class="team-logo-dialog-head"><div><div class="eyebrow">Team Branding</div><h3 id="team-logo-title">Logo Pasukan</h3></div><button type="button" class="btn" id="team-logo-close">Tutup</button></div>
    <div class="team-logo-large-preview" id="team-logo-preview"><span>TM</span></div>
    <div class="field"><label>Logo Pasukan</label><input id="team-logo-edit-url" type="text" inputmode="url" placeholder="./assets/team-logos/team.png atau https://..."><div class="auto-seed-note">Logo dipaparkan pada Dashboard, Live Screen, Bracket dan OBS Overlay. Fail dalam repo boleh guna path relatif.</div></div>
    <div class="actions" style="margin-top:14px"><button type="button" class="btn primary" id="team-logo-save">Simpan Logo</button><button type="button" class="btn danger" id="team-logo-clear">Buang Logo</button></div>
  </div>`;
  document.body.appendChild(modal);
}
function previewInto(el,url,name){
  if(!el)return;el.innerHTML='';
  const src=displayLogoUrl(url);
  if(src){const img=document.createElement('img');img.src=src;img.alt=`Logo ${name||'pasukan'}`;img.onerror=()=>{el.innerHTML=`<span>${initials(name)}</span>`};el.appendChild(img)}
  else{const span=document.createElement('span');span.textContent=initials(name);el.appendChild(span)}
}
async function loadLogoRows(){
  if(!isConfigured()||!supabase)return;
  const {data,error}=await supabase.from('teams').select('id,name,short_name,logo_url');
  if(error)return;
  logoRows=new Map((data||[]).map(t=>[t.id,t]));decorateRows();
}
function decorateRows(){
  const table=$('#team-table');if(!table)return;
  for(const row of [...table.querySelectorAll('tr')]){
    const del=row.querySelector('[data-delete-team]');if(!del)continue;
    const id=del.dataset.deleteTeam,t=logoRows.get(id);if(!t)continue;
    const nameCell=row.children[2];
    if(nameCell&&!nameCell.querySelector('.admin-team-logo-preview')){
      const existing=nameCell.innerHTML;nameCell.innerHTML='';
      const wrap=document.createElement('div');wrap.className='admin-team-logo-cell';
      const preview=document.createElement('div');preview.className='admin-team-logo-preview';preview.dataset.teamLogoPreview=id;
      const copy=document.createElement('div');copy.innerHTML=existing;
      wrap.append(preview,copy);nameCell.appendChild(wrap);previewInto(preview,t.logo_url,t.name);
    }
    const actionCell=row.lastElementChild;
    if(actionCell&&!actionCell.querySelector('[data-edit-team-logo]')){
      const btn=document.createElement('button');btn.type='button';btn.className='btn small';btn.dataset.editTeamLogo=id;btn.textContent=t.logo_url?'Logo ✓':'Logo';actionCell.prepend(btn);
    }
  }
}
function openModal(id){
  const t=logoRows.get(id);if(!t)return;
  activeTeamId=id;ensureModal();
  $('#team-logo-title').textContent=t.name||'Logo Pasukan';
  $('#team-logo-edit-url').value=t.logo_url||'';
  previewInto($('#team-logo-preview'),t.logo_url,t.name);
  $('#team-logo-modal').classList.add('open');
  setTimeout(()=>$('#team-logo-edit-url')?.focus(),50);
}
function closeModal(){activeTeamId='';$('#team-logo-modal')?.classList.remove('open')}
async function saveExistingLogo(clear=false){
  if(!activeTeamId)return;
  const t=logoRows.get(activeTeamId);if(!t)return;
  const raw=clear?'':($('#team-logo-edit-url')?.value||'').trim();
  const url=raw?normalizeLogoUrl(raw):'';
  if(raw&&!url)return showGlobal('Logo tidak sah. Guna path ./assets/... atau URL http/https.','error');
  const {error}=await supabase.from('teams').update({logo_url:url||null}).eq('id',activeTeamId);
  if(error)return showGlobal(error.message,'error');
  t.logo_url=url||null;logoRows.set(activeTeamId,t);
  previewInto($(`[data-team-logo-preview="${activeTeamId}"]`),t.logo_url,t.name);
  const btn=$(`[data-edit-team-logo="${activeTeamId}"]`);if(btn)btn.textContent=t.logo_url?'Logo ✓':'Logo';
  showGlobal(clear?'Logo pasukan dibuang.':'Logo pasukan disimpan.','success');closeModal();
}
async function addTeamWithLogo(event){
  if(!isConfigured()||!supabase)return;
  event.preventDefault();event.stopImmediatePropagation();
  const gid=$('#team-game')?.value||'',name=$('#team-name')?.value.trim()||'',short=($('#team-short')?.value||'').trim().toUpperCase();
  if(!gid||!name)return showGlobal('Pilih game dan masukkan nama pasukan.','error');
  const raw=($('#team-logo-url')?.value||'').trim(),logo=raw?normalizeLogoUrl(raw):'';
  if(raw&&!logo)return showGlobal('Logo tidak sah. Guna path ./assets/... atau URL http/https.','error');
  const {data:game,error:gErr}=await supabase.from('games').select('tournament_id').eq('id',gid).single();
  if(gErr||!game?.tournament_id)return showGlobal(gErr?.message||'Tournament tidak ditemui.','error');
  const seed=Number($('#team-seed')?.value||1);
  const payload={tournament_id:game.tournament_id,game_id:gid,name,short_name:short,logo_url:logo||null,seed_order:seed};
  const {error}=await supabase.from('teams').insert(payload);
  if(error)return showGlobal(error.message,'error');
  showGlobal('Pasukan ditambah bersama logo.','success');
  setTimeout(()=>location.reload(),650);
}
function bind(){
  ensureAddField();ensureModal();
  const form=$('#team-form');if(form&&!form.dataset.logoHandler){form.dataset.logoHandler='1';form.addEventListener('submit',addTeamWithLogo,true)}
  document.addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit-team-logo]');if(edit){openModal(edit.dataset.editTeamLogo);return}
    if(e.target.closest('#team-logo-close')){closeModal();return}
    if(e.target.closest('#team-logo-save')){saveExistingLogo(false);return}
    if(e.target.closest('#team-logo-clear')){saveExistingLogo(true);return}
    if(e.target.id==='team-logo-modal')closeModal();
  });
  $('#team-logo-edit-url')?.addEventListener('input',e=>{const t=logoRows.get(activeTeamId);previewInto($('#team-logo-preview'),e.target.value,t?.name||'TEAM')});
  const table=$('#team-table');if(table)new MutationObserver(()=>decorateRows()).observe(table,{childList:true,subtree:true});
  loadLogoRows();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
