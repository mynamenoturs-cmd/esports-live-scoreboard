import { supabase, isConfigured } from './supabase-client.js';

const $ = (s) => document.querySelector(s);
let currentRole = null;
let installed = false;

function ensurePanel() {
  let panel = $('#event-operations');
  if (panel) return panel;
  const anchor = $('#live-control') || $('#tournament-generator');
  if (!anchor) return null;
  panel = document.createElement('section');
  panel.id = 'event-operations';
  panel.className = 'panel section hidden';
  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>Operasi Hari Pertandingan</h2>
        <div class="subtle small">Laraskan masa dan reset data tanpa menyentuh akaun admin/marshal.</div>
      </div>
      <span id="ops-game-label" class="chip">—</span>
    </div>
    <div class="panel-body">
      <div id="ops-notice" class="notice hidden" style="margin-bottom:14px"></div>
      <div class="form-grid">
        <div class="field span-2">
          <label>Laraskan semua match BELUM BERMULA untuk game dipilih</label>
          <div class="actions" style="margin-top:8px">
            <button type="button" class="btn" data-shift="10">+10 min</button>
            <button type="button" class="btn" data-shift="15">+15 min</button>
            <button type="button" class="btn" data-shift="30">+30 min</button>
            <button type="button" class="btn" data-shift="-10">−10 min</button>
          </div>
          <div class="auto-seed-note">Hanya status SCHEDULED dengan masa yang telah ditetapkan akan berubah. LIVE dan FINISHED kekal.</div>
        </div>
        <div class="field span-2">
          <label>Reset game dipilih</label>
          <div class="actions" style="margin-top:8px">
            <button type="button" id="reset-results" class="btn">Reset Keputusan Sahaja</button>
            <button type="button" id="reset-schedule" class="btn danger">Reset Jadual & Bracket</button>
          </div>
          <div class="auto-seed-note">Reset Keputusan mengekalkan pasukan/jadual. Reset Jadual & Bracket memadam semua match game itu tetapi mengekalkan pasukan dan roster.</div>
        </div>
        <div id="full-reset-wrap" class="field span-2 hidden">
          <label>Zon Admin · Reset Seluruh Tournament</label>
          <div class="notice error" style="margin:8px 0 10px">Memadam semua match, semua pasukan dan roster untuk semua game. Nama tournament, konfigurasi game, admin dan marshal kekal.</div>
          <button type="button" id="full-reset" class="btn danger big">FULL RESET TOURNAMENT</button>
        </div>
      </div>
    </div>`;
  anchor.insertAdjacentElement('beforebegin', panel);
  return panel;
}

function showNotice(text, type='notice') {
  const el = $('#ops-notice');
  if (!el) return;
  el.textContent = text;
  el.className = `notice ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 7000);
}

function selectedGame() {
  const el = $('#generator-game');
  return { id: el?.value || '', label: el?.selectedOptions?.[0]?.textContent?.trim() || 'Game' };
}

function syncLabel() {
  const { label } = selectedGame();
  const el = $('#ops-game-label');
  if (el) el.textContent = label;
}

async function loadRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data?.role || null;
}

async function shiftSchedule(minutes) {
  const game = selectedGame();
  if (!game.id) return showNotice('Pilih game dahulu.', 'error');
  const direction = minutes > 0 ? `tambah ${minutes} minit` : `tolak ${Math.abs(minutes)} minit`;
  if (!confirm(`Sahkan ${direction} untuk semua match ${game.label} yang belum bermula?`)) return;
  const { data, error } = await supabase.rpc('shift_scheduled_matches', { p_game_id: game.id, p_minutes: minutes });
  if (error) return showNotice(error.message, 'error');
  showNotice(`${data || 0} match berjaya dilaraskan ${minutes > 0 ? '+' : ''}${minutes} minit.`, 'success');
  setTimeout(() => location.reload(), 700);
}

async function resetResults() {
  const game = selectedGame();
  if (!game.id) return showNotice('Pilih game dahulu.', 'error');
  if (!confirm(`Reset SEMUA keputusan ${game.label}? Jadual, pasukan dan roster akan kekal.`)) return;
  const second = prompt('Taip RESET RESULTS untuk mengesahkan:');
  if (second !== 'RESET RESULTS') return showNotice('Reset dibatalkan.', 'notice');
  const { data, error } = await supabase.rpc('reset_game_results', { p_game_id: game.id });
  if (error) return showNotice(error.message, 'error');
  showNotice(`${data || 0} match telah direset.`, 'success');
  setTimeout(() => location.reload(), 700);
}

async function resetSchedule() {
  const game = selectedGame();
  if (!game.id) return showNotice('Pilih game dahulu.', 'error');
  if (!confirm(`Padam SEMUA jadual/match ${game.label}? Pasukan dan roster akan kekal.`)) return;
  const second = prompt('Taip RESET SCHEDULE untuk mengesahkan:');
  if (second !== 'RESET SCHEDULE') return showNotice('Reset dibatalkan.', 'notice');
  const { data, error } = await supabase.rpc('reset_game_schedule', { p_game_id: game.id });
  if (error) return showNotice(error.message, 'error');
  showNotice(`${data || 0} match telah dipadam. Pasukan kekal.`, 'success');
  setTimeout(() => location.reload(), 700);
}

async function fullReset() {
  if (currentRole !== 'admin') return showNotice('Hanya admin boleh Full Reset Tournament.', 'error');
  const game = selectedGame();
  if (!game.id) return showNotice('Pilih mana-mana game dahulu.', 'error');
  const { data: gameRow, error: gameError } = await supabase.from('games').select('tournament_id').eq('id', game.id).single();
  if (gameError || !gameRow?.tournament_id) return showNotice(gameError?.message || 'Tournament tidak ditemui.', 'error');
  if (!confirm('FULL RESET akan memadam SEMUA match, pasukan dan roster FIFA + MLBB. Akaun admin/marshal dan konfigurasi sistem kekal. Teruskan?')) return;
  const phrase = prompt('Taip tepat: RESET TOURNAMENT');
  if (phrase !== 'RESET TOURNAMENT') return showNotice('Full reset dibatalkan.', 'notice');
  const { data, error } = await supabase.rpc('full_reset_tournament', { p_tournament_id: gameRow.tournament_id });
  if (error) return showNotice(error.message, 'error');
  showNotice(`Full reset selesai. ${data?.deleted_matches || 0} match dan ${data?.deleted_teams || 0} pasukan dipadam.`, 'success');
  setTimeout(() => location.reload(), 900);
}

async function boot() {
  if (!isConfigured() || !supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const panel = ensurePanel();
  if (!panel) return;
  try {
    currentRole = await loadRole();
    if (!['admin','marshal'].includes(currentRole)) return;
    panel.classList.remove('hidden');
    $('#full-reset-wrap')?.classList.toggle('hidden', currentRole !== 'admin');
    syncLabel();
    if (!installed) {
      installed = true;
      $('#generator-game')?.addEventListener('change', syncLabel);
      panel.addEventListener('click', (event) => {
        const shift = event.target.closest('[data-shift]');
        if (shift) return shiftSchedule(Number(shift.dataset.shift));
        if (event.target.closest('#reset-results')) return resetResults();
        if (event.target.closest('#reset-schedule')) return resetSchedule();
        if (event.target.closest('#full-reset')) return fullReset();
      });
    }
  } catch (err) {
    panel.classList.remove('hidden');
    showNotice(err?.message || 'Gagal memuatkan operasi tournament.', 'error');
  }
}

boot();
supabase?.auth?.onAuthStateChange?.((event, session) => {
  if (session && ['SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'].includes(event)) setTimeout(boot, 50);
});
