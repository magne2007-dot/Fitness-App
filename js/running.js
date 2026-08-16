import { Store, todayISO, uid, fmtDateShort } from './storage.js';

const K_LOG = 'cardio_log';        // [{id,date,type,distance_km,duration_min,source,strava_id}]
const K_STRAVA_APP = 'strava_app'; // {client_id, client_secret, redirect_uri}
const K_STRAVA_TOK = 'strava_tokens'; // {access_token, refresh_token, expires_at, athlete_name}

function getLog() { return Store.get(K_LOG, []); }
function getStravaApp() { return Store.get(K_STRAVA_APP, null); }
function getStravaTokens() { return Store.get(K_STRAVA_TOK, null); }

export function renderRunning() {
  const log = getLog().slice().sort((a,b)=> b.date.localeCompare(a.date));
  const tokens = getStravaTokens();
  const week = weekTotals(log);

  let html = `
  <div class="card">
    <h2>Denne uge</h2>
    <div class="stats-grid">
      <div class="stat"><div class="val">${week.km.toFixed(1)}</div><div class="lbl">km</div></div>
      <div class="stat"><div class="val">${week.min}</div><div class="lbl">min</div></div>
      <div class="stat"><div class="val">${week.count}</div><div class="lbl">ture</div></div>
    </div>
  </div>

  <div class="card">
    <div class="card-row"><h2 style="margin:0">Strava</h2></div>
    ${tokens ?
      `<div class="rs" style="margin-bottom:10px">Forbundet${tokens.athlete_name ? ' som ' + tokens.athlete_name : ''}</div>
       <button class="btn btn-ghost" onclick="Running.syncStrava()">Hent nye aktiviteter</button>
       <button class="btn btn-ghost" onclick="Running.disconnectStrava()">Afbryd forbindelse</button>` :
      `<div class="rs" style="margin-bottom:10px">Forbind din Strava-konto for automatisk at hente løbe- og cykelture.</div>
       <button class="btn btn-accent" onclick="Running.connectStrava()">Forbind til Strava</button>
       <button class="btn btn-ghost" onclick="Running.openStravaSettings()">Strava app-indstillinger</button>`}
  </div>

  <div class="card">
    <div class="card-row"><h2 style="margin:0">Log</h2>
      <button class="btn-sm" onclick="Running.openAdd()">+ Tilføj</button>
    </div>
    ${log.length === 0 ? `<div class="empty"><div class="ic">🏃</div>Ingen ture endnu</div>` :
      log.slice(0,20).map(e => `
        <div class="row">
          <div><div class="rt">${e.type==='run'?'🏃 Løb':'🚴 Cykel'} · ${e.distance_km} km</div>
          <div class="rs">${fmtDateShort(e.date)} · ${e.duration_min} min${e.source==='strava'?' · Strava':''}</div></div>
          <button class="swipe-del" onclick="Running.remove('${e.id}')">✕</button>
        </div>`).join('')}
  </div>`;

  document.getElementById('view-running').innerHTML = html;
}

function weekTotals(log) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday=0
  const monday = new Date(now); monday.setDate(now.getDate() - day);
  const mondayISO = monday.toISOString().split('T')[0];
  const entries = log.filter(e => e.date >= mondayISO);
  return {
    km: entries.reduce((s,e)=>s+e.distance_km,0),
    min: Math.round(entries.reduce((s,e)=>s+e.duration_min,0)),
    count: entries.length
  };
}

// ---------- Manual entries ----------
function openAdd() {
  document.getElementById('sheet-title').textContent = 'Tilføj tur';
  document.getElementById('sheet-body').innerHTML = `
    <div class="label">Type</div>
    <select id="rn-type"><option value="run">Løb</option><option value="ride">Cykel</option></select>
    <div class="label">Dato</div>
    <input type="date" id="rn-date" value="${todayISO()}">
    <div class="label">Distance (km)</div>
    <input type="number" id="rn-dist" step="0.1" placeholder="fx 5.2">
    <div class="label">Varighed (min)</div>
    <input type="number" id="rn-dur" placeholder="fx 28">
    <button class="btn btn-accent" onclick="Running.save()">Gem</button>
  `;
  openSheet();
}

function save() {
  const type = document.getElementById('rn-type').value;
  const date = document.getElementById('rn-date').value || todayISO();
  const distance_km = parseFloat(document.getElementById('rn-dist').value) || 0;
  const duration_min = parseInt(document.getElementById('rn-dur').value) || 0;
  if (!distance_km) return;
  Store.update(K_LOG, [], list => { list.push({ id: uid(), date, type, distance_km, duration_min, source: 'manual' }); return list; });
  closeSheet();
  renderRunning();
  window.Dashboard && window.Dashboard.render();
}

function remove(id) {
  Store.update(K_LOG, [], list => list.filter(e => e.id !== id));
  renderRunning();
  window.Dashboard && window.Dashboard.render();
}

// ---------- Strava ----------
function openStravaSettings() {
  const app = getStravaApp() || {};
  document.getElementById('sheet-title').textContent = 'Strava app-indstillinger';
  document.getElementById('sheet-body').innerHTML = `
    <div class="tip"><div class="tip-text">Opret en gratis app på strava.com/settings/api. Sæt "Authorization Callback Domain" til det domæne appen kører på (uden https://). Redirect URI herunder skal matche den side, du åbner appen fra.</div></div>
    <div class="label">Client ID</div>
    <input type="text" id="sv-id" value="${app.client_id || ''}">
    <div class="label">Client Secret</div>
    <input type="text" id="sv-secret" value="${app.client_secret || ''}">
    <div class="label">Redirect URI</div>
    <input type="text" id="sv-redirect" value="${app.redirect_uri || window.location.origin + window.location.pathname}">
    <button class="btn btn-accent" onclick="Running.saveStravaSettings()">Gem</button>
  `;
  openSheet();
}

function saveStravaSettings() {
  const client_id = document.getElementById('sv-id').value.trim();
  const client_secret = document.getElementById('sv-secret').value.trim();
  const redirect_uri = document.getElementById('sv-redirect').value.trim();
  Store.set(K_STRAVA_APP, { client_id, client_secret, redirect_uri });
  closeSheet();
  renderRunning();
}

function connectStrava() {
  const app = getStravaApp();
  if (!app || !app.client_id) { openStravaSettings(); return; }
  const url = `https://www.strava.com/oauth/authorize?client_id=${app.client_id}&redirect_uri=${encodeURIComponent(app.redirect_uri)}&response_type=code&approval_prompt=auto&scope=activity:read_all`;
  window.location.href = url;
}

function disconnectStrava() {
  localStorage.removeItem(K_STRAVA_TOK);
  renderRunning();
}

export async function handleStravaRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;
  const app = getStravaApp();
  if (!app) return;
  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: app.client_id,
        client_secret: app.client_secret,
        code,
        grant_type: 'authorization_code'
      })
    });
    const data = await res.json();
    if (data.access_token) {
      Store.set(K_STRAVA_TOK, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        athlete_name: data.athlete ? [data.athlete.firstname, data.athlete.lastname].filter(Boolean).join(' ') : ''
      });
    }
  } catch (err) {
    console.error('Strava token exchange failed', err);
    alert('Kunne ikke forbinde til Strava. Hvis fejlen gentager sig, kræver Strava sandsynligvis en lille server-funktion til token-udveksling — sig til, så bygger vi det.');
  }
  window.history.replaceState({}, '', window.location.pathname);
}

async function ensureFreshToken() {
  let tok = getStravaTokens();
  if (!tok) return null;
  if (tok.expires_at && tok.expires_at * 1000 < Date.now()) {
    const app = getStravaApp();
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: app.client_id, client_secret: app.client_secret,
        grant_type: 'refresh_token', refresh_token: tok.refresh_token
      })
    });
    const data = await res.json();
    tok = { ...tok, access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
    Store.set(K_STRAVA_TOK, tok);
  }
  return tok;
}

async function syncStrava() {
  const tok = await ensureFreshToken();
  if (!tok) return;
  try {
    const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: { Authorization: `Bearer ${tok.access_token}` }
    });
    const activities = await res.json();
    if (!Array.isArray(activities)) throw new Error('unexpected response');
    const existing = getLog();
    const existingIds = new Set(existing.filter(e => e.strava_id).map(e => e.strava_id));
    const added = [];
    activities.forEach(a => {
      if (existingIds.has(a.id)) return;
      if (!['Run', 'Ride', 'VirtualRide', 'TrailRun'].includes(a.type)) return;
      added.push({
        id: uid(), strava_id: a.id,
        date: a.start_date_local.split('T')[0],
        type: a.type.includes('Ride') ? 'ride' : 'run',
        distance_km: Math.round(a.distance / 100) / 10,
        duration_min: Math.round(a.moving_time / 60),
        source: 'strava'
      });
    });
    Store.update(K_LOG, [], list => list.concat(added));
    renderRunning();
    window.Dashboard && window.Dashboard.render();
  } catch (err) {
    console.error(err);
    alert('Kunne ikke hente aktiviteter fra Strava lige nu.');
  }
}

window.Running = {
  openAdd, save, remove, openStravaSettings, saveStravaSettings,
  connectStrava, disconnectStrava, syncStrava
};

function openSheet() { document.getElementById('sheet-backdrop').classList.add('open'); }
function closeSheet() { document.getElementById('sheet-backdrop').classList.remove('open'); }
