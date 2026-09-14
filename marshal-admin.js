import { supabase, isConfigured } from './supabase-client.js';

const $ = (s) => document.querySelector(s);
const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function ensurePanel() {
  let panel = $('#marshal-management');
  if (panel) return panel;
  const anchor = $('#tournament-generator');
  if (!anchor) return null;
  panel = document.createElement('section');
  panel.id = 'marshal-management';
  panel.className = 'panel section hidden';
  panel.innerHTML = `
    <div class="panel-head">
      <div><h2>Pengurusan Marshal</h2><div class="subtle small">Admin sahaja boleh mencipta dan mengubah akses marshal.</div></div>
      <button id="marshal-refresh" type="button" class="btn small">Refresh</button>
    </div>
    <div class="panel-body">
      <div id="marshal-notice" class="notice hidden" style="margin-bottom:14px"></div>
      <form id="marshal-form" class="form-grid">
        <div class="field"><label>Nama Marshal</label><input id="marshal-name" placeholder="Contoh: Marshal 1"></div>
        <div class="field"><label>Email</label><input id="marshal-email" type="email" required autocomplete="off" placeholder="marshal@example.com"></div>
        <div class="field span-2"><label>Password Sementara</label><input id="marshal-password" type="password" minlength="8" required autocomplete="new-password" placeholder="Minimum 8 aksara"><div class="auto-seed-note">Akaun akan disahkan terus dan boleh login di /admin. Simpan password ini dan beri kepada marshal melalui saluran yang sesuai.</div></div>
        <button class="btn primary field span-2" type="submit">+ Cipta Akaun Marshal</button>
      </form>
      <div class="table-wrap" style="margin-top:18px">
        <table>
          <thead><tr><th>Pengguna</th><th>Role</th><th>Login Terakhir</th><th>Tindakan</th></tr></thead>
          <tbody id="marshal-table-body"><tr><td colspan="4">Memuatkan...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  anchor.insertAdjacentElement('beforebegin', panel);
  return panel;
}

const panel = ensurePanel();
const form = $('#marshal-form');
const body = $('#marshal-table-body');
const notice = $('#marshal-notice');
const refreshBtn = $('#marshal-refresh');

function showNotice(text, type='notice') {
  if (!notice) return;
  notice.textContent = text;
  notice.className = `notice ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
  notice.classList.remove('hidden');
  window.setTimeout(() => notice.classList.add('hidden'), 6500);
}

async function invoke(bodyPayload) {
  const { data, error } = await supabase.functions.invoke('manage-marshals', { body: bodyPayload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data || {};
}

function roleChip(role) {
  const label = role === 'admin' ? 'ADMIN' : role === 'marshal' ? 'MARSHAL' : 'VIEWER';
  const extra = role === 'marshal' ? ' live' : role === 'admin' ? ' finished' : '';
  return `<span class="chip${extra}">${label}</span>`;
}

function render(users=[]) {
  if (!body) return;
  body.innerHTML = users.map(u => {
    let action = '<span class="subtle small">—</span>';
    if (u.role === 'marshal') {
      action = `<button class="btn small danger" data-user-role="viewer" data-user-id="${esc(u.id)}">Buang Akses Marshal</button>`;
    } else if (u.role === 'viewer') {
      action = `<button class="btn small good" data-user-role="marshal" data-user-id="${esc(u.id)}">Jadikan Marshal</button>`;
    }
    return `<tr>
      <td><strong>${esc(u.display_name || u.email || 'Pengguna')}</strong><div class="subtle small">${esc(u.email || '')}</div></td>
      <td>${roleChip(u.role)}</td>
      <td>${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('ms-MY') : '<span class="subtle">Belum login</span>'}</td>
      <td>${action}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="4">Belum ada pengguna.</td></tr>';
}

async function loadUsers({quiet=false}={}) {
  if (!isConfigured() || !supabase || !panel) return;
  try {
    const data = await invoke({ action: 'list' });
    panel.classList.remove('hidden');
    render(data.users || []);
    if (!quiet) showNotice('Senarai akaun dikemas kini.', 'success');
  } catch (err) {
    const message = String(err?.message || err || '');
    if (/403|admin access|required|forbidden|non-2xx/i.test(message)) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    showNotice(message || 'Gagal memuatkan akaun.', 'error');
  }
}

async function createMarshal(event) {
  event.preventDefault();
  const email = $('#marshal-email')?.value.trim() || '';
  const password = $('#marshal-password')?.value || '';
  const display_name = $('#marshal-name')?.value.trim() || '';
  if (!email || !password) return showNotice('Masukkan email dan password sementara.', 'error');
  if (password.length < 8) return showNotice('Password sementara mesti sekurang-kurangnya 8 aksara.', 'error');

  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const data = await invoke({ action: 'create_marshal', email, password, display_name });
    form.reset();
    showNotice(data.existing ? 'Akaun sedia ada telah dinaikkan kepada Marshal dan password dikemas kini.' : 'Akaun Marshal berjaya dicipta.', 'success');
    await loadUsers({quiet:true});
  } catch (err) {
    showNotice(err?.message || 'Gagal mencipta akaun Marshal.', 'error');
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function changeRole(userId, role) {
  const label = role === 'marshal' ? 'beri akses Marshal kepada pengguna ini' : 'buang akses Marshal daripada pengguna ini';
  if (!confirm(`Sahkan untuk ${label}?`)) return;
  try {
    await invoke({ action: 'set_role', user_id: userId, role });
    showNotice(role === 'marshal' ? 'Akses Marshal diberikan.' : 'Akses Marshal dibuang. Akaun kekal sebagai Viewer.', 'success');
    await loadUsers({quiet:true});
  } catch (err) {
    showNotice(err?.message || 'Gagal mengubah role.', 'error');
  }
}

form?.addEventListener('submit', createMarshal);
refreshBtn?.addEventListener('click', () => loadUsers());
document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-user-role]');
  if (!btn) return;
  changeRole(btn.dataset.userId, btn.dataset.userRole);
});

async function boot() {
  if (!isConfigured() || !supabase || !panel) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await loadUsers({quiet:true});
}

boot();
