import { Store } from './storage.js';

const K_CONFIG = 'supabase_config'; // {url, anonKey} — device-local, never synced
const SYNCED_KEYS = ['kcal_log', 'kcal_target', 'strength_templates', 'strength_sessions', 'cardio_log', 'cooper_setup'];

let supabase = null;
let supabaseLib = null;
let user = null;
let pending = new Set();
let pushTimer = null;

export function getConfig() { return Store.get(K_CONFIG, null); }
export function isConfigured() { const c = getConfig(); return !!(c && c.url && c.anonKey); }
export function getCurrentUser() { return user; }

async function loadLib() {
  if (!supabaseLib) supabaseLib = await import('https://esm.sh/@supabase/supabase-js@2');
  return supabaseLib;
}

async function client() {
  if (supabase) return supabase;
  const cfg = getConfig();
  if (!cfg || !cfg.url || !cfg.anonKey) return null;
  const { createClient } = await loadLib();
  supabase = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  return supabase;
}

export function saveConfig(url, anonKey) {
  Store.set(K_CONFIG, { url: url.trim(), anonKey: anonKey.trim() });
  supabase = null; // force re-init with new config
  user = null;
}

export function clearConfig() {
  localStorage.removeItem(K_CONFIG);
  supabase = null;
  user = null;
}

// Called once at boot. Restores session if one exists (incl. from a magic-link redirect).
export async function init() {
  if (!isConfigured()) { updateBadge(); return; }
  const sb = await client();
  if (!sb) { updateBadge(); return; }
  const { data } = await sb.auth.getSession();
  user = data.session ? data.session.user : null;
  if (user) await syncOnLogin();
  window.history.replaceState({}, '', window.location.pathname);
  updateBadge();
}

export async function sendMagicLink(email) {
  const sb = await client();
  if (!sb) throw new Error('Supabase er ikke sat op endnu');
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}

export async function logout() {
  const sb = await client();
  if (sb) await sb.auth.signOut();
  user = null;
  updateBadge();
}

// First login: if the cloud has no data yet, push local data up.
// Otherwise, cloud is treated as the source of truth and gets pulled down.
async function syncOnLogin() {
  const sb = await client();
  if (!sb || !user) return;
  const { data, error } = await sb.from('user_data').select('key').eq('user_id', user.id);
  if (error) { console.error('sync check failed', error); return; }
  const existingKeys = new Set((data || []).map(r => r.key));
  if (existingKeys.size === 0) {
    const rows = SYNCED_KEYS
      .map(k => ({ user_id: user.id, key: k, value: Store.get(k, null) }))
      .filter(r => r.value !== null);
    if (rows.length) {
      const { error: upErr } = await sb.from('user_data').upsert(rows, { onConflict: 'user_id,key' });
      if (upErr) console.error('initial push failed', upErr);
    }
  } else {
    await pullAll();
  }
}

async function pullAll() {
  const sb = await client();
  if (!sb || !user) return;
  const { data, error } = await sb.from('user_data').select('key,value').eq('user_id', user.id);
  if (error) { console.error('pull failed', error); return; }
  data.forEach(row => localStorage.setItem(row.key, JSON.stringify(row.value)));
}

function schedulePush(key) {
  pending.add(key);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, 600);
}

async function flushPush() {
  const keys = Array.from(pending);
  pending.clear();
  if (!user) return;
  const sb = await client();
  if (!sb) return;
  const rows = keys.map(k => ({ user_id: user.id, key: k, value: Store.get(k, null), updated_at: new Date().toISOString() }));
  const { error } = await sb.from('user_data').upsert(rows, { onConflict: 'user_id,key' });
  if (error) console.error('sync push failed', error);
}

window.__onStoreChange = (key) => {
  if (SYNCED_KEYS.includes(key)) schedulePush(key);
};

// ---------- UI ----------
function updateBadge() {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  if (!isConfigured()) el.textContent = '☁ Ikke sat op';
  else if (!user) el.textContent = '☁ Log ind for sync';
  else el.textContent = '☁ ' + user.email;
}

function openPanel() {
  const title = document.getElementById('sheet-title');
  const body = document.getElementById('sheet-body');
  title.textContent = 'Synkronisering';

  if (!isConfigured()) {
    body.innerHTML = `
      <div class="tip"><div class="tip-text">Opret et gratis projekt på supabase.com, opsæt tabellen (se chatten for SQL), og indsæt dine nøgler her for at synkronisere data mellem dine enheder.</div></div>
      <div class="label">Project URL</div>
      <input type="text" id="sb-url" placeholder="https://xxxx.supabase.co">
      <div class="label">Anon public key</div>
      <input type="text" id="sb-key" placeholder="eyJ...">
      <button class="btn btn-accent" onclick="Sync.saveConfigFromForm()">Gem</button>
    `;
  } else if (!user) {
    body.innerHTML = `
      <div class="rs" style="margin-bottom:10px">Forbundet til Supabase. Log ind for at synkronisere dine data.</div>
      <div class="label">Email</div>
      <input type="text" id="sb-email" placeholder="din@email.dk">
      <button class="btn btn-accent" onclick="Sync.loginFromForm()">Send login-link</button>
      <button class="btn btn-ghost" onclick="Sync.editConfig()">Skift Supabase-projekt</button>
    `;
  } else {
    body.innerHTML = `
      <div class="rs" style="margin-bottom:10px">Synkroniseret som <strong>${user.email}</strong></div>
      <button class="btn btn-ghost" onclick="Sync.logoutFromForm()">Log ud</button>
    `;
  }
  document.getElementById('sheet-backdrop').classList.add('open');
}

function editConfig() {
  clearConfig();
  updateBadge();
  openPanel();
}

function saveConfigFromForm() {
  const url = document.getElementById('sb-url').value;
  const anonKey = document.getElementById('sb-key').value;
  if (!url || !anonKey) return;
  saveConfig(url, anonKey);
  updateBadge();
  openPanel();
}

async function loginFromForm() {
  const email = document.getElementById('sb-email').value.trim();
  if (!email) return;
  try {
    await sendMagicLink(email);
    document.getElementById('sheet-body').innerHTML = `<div class="rs">Tjek din email — klik på linket for at logge ind. Du kan lukke dette vindue.</div>`;
  } catch (err) {
    console.error(err);
    alert('Kunne ikke sende login-link. Tjek at URL og nøgle er korrekte.');
  }
}

async function logoutFromForm() {
  await logout();
  document.getElementById('sheet-backdrop').classList.remove('open');
}

window.Sync = { openPanel, editConfig, saveConfigFromForm, loginFromForm, logoutFromForm };

export { updateBadge };
