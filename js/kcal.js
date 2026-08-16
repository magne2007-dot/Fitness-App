import { Store, todayISO, uid, fmtDateShort } from './storage.js';

const K_LOG = 'kcal_log';       // { '2026-08-16': [{id,name,kcal,protein,time}] }
const K_TARGET = 'kcal_target'; // number

let viewDate = todayISO();

function getDay(date) {
  const log = Store.get(K_LOG, {});
  return log[date] || [];
}

function addEntry(date, entry) {
  Store.update(K_LOG, {}, log => {
    log[date] = log[date] || [];
    log[date].push(entry);
    return log;
  });
}

function removeEntry(date, id) {
  Store.update(K_LOG, {}, log => {
    log[date] = (log[date] || []).filter(e => e.id !== id);
    return log;
  });
}

function getTarget() {
  return Store.get(K_TARGET, 2200);
}

export function renderKcal() {
  const target = getTarget();
  const entries = getDay(viewDate);
  const total = entries.reduce((s, e) => s + e.kcal, 0);
  const protein = entries.reduce((s, e) => s + (e.protein || 0), 0);
  const remaining = target - total;
  const pct = Math.min(100, Math.round((total / target) * 100));
  const isToday = viewDate === todayISO();

  const ringColor = pct > 100 ? 'var(--accent)' : 'var(--good)';

  let html = `
  <div class="card">
    <div class="card-row" style="margin-bottom:14px">
      <button class="btn-icon" onclick="Kcal.shiftDay(-1)">‹</button>
      <h2 style="margin:0">${isToday ? 'I dag' : fmtDateShort(viewDate)}</h2>
      <button class="btn-icon" onclick="Kcal.shiftDay(1)" ${isToday ? 'disabled style="opacity:.3"' : ''}>›</button>
    </div>
    <div class="load-ring-wrap" style="justify-content:center">
      <div class="load-ring" style="width:140px;height:140px">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="60" fill="none" stroke="var(--surface-sunken)" stroke-width="12"/>
          <circle cx="70" cy="70" r="60" fill="none" stroke="${ringColor}" stroke-width="12"
            stroke-linecap="round" stroke-dasharray="${2*Math.PI*60}"
            stroke-dashoffset="${2*Math.PI*60*(1-pct/100)}"/>
        </svg>
        <div class="center">
          <div class="n">${total}</div>
          <div class="t">af ${target} kcal</div>
        </div>
      </div>
    </div>
    <div class="stats-grid" style="margin-top:14px">
      <div class="stat"><div class="val">${remaining>=0?remaining:0}</div><div class="lbl">Tilbage</div></div>
      <div class="stat"><div class="val">${protein}g</div><div class="lbl">Protein</div></div>
      <div class="stat"><div class="val">${entries.length}</div><div class="lbl">Måltider</div></div>
    </div>
    <button class="btn btn-ghost" onclick="Kcal.openTarget()" style="margin-top:12px">Justér mål (${target} kcal)</button>
  </div>

  <div class="card">
    <h2>Logget</h2>
    ${entries.length === 0 ? `<div class="empty"><div class="ic">🍽️</div>Intet logget endnu</div>` :
      entries.slice().reverse().map(e => `
        <div class="row">
          <div><div class="rt">${e.name}</div><div class="rs">${e.time || ''}${e.protein ? ' · ' + e.protein + 'g protein' : ''}</div></div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="rt">${e.kcal}</div>
            <button class="swipe-del" onclick="Kcal.remove('${e.id}')">✕</button>
          </div>
        </div>`).join('')}
  </div>`;

  document.getElementById('view-kcal').innerHTML = html;
}

function openAdd() {
  document.getElementById('sheet-title').textContent = 'Log måltid';
  document.getElementById('sheet-body').innerHTML = `
    <div class="label">Navn</div>
    <input type="text" id="kc-name" placeholder="fx Kylling med ris">
    <div class="label">Kalorier</div>
    <input type="number" id="kc-kcal" placeholder="fx 650">
    <div class="label">Protein (g, valgfrit)</div>
    <input type="number" id="kc-protein" placeholder="fx 40">
    <button class="btn btn-accent" onclick="Kcal.save()">Gem</button>
  `;
  openSheet();
}

function save() {
  const name = document.getElementById('kc-name').value.trim();
  const kcal = parseInt(document.getElementById('kc-kcal').value) || 0;
  const protein = parseInt(document.getElementById('kc-protein').value) || 0;
  if (!name || !kcal) return;
  addEntry(viewDate, {
    id: uid(), name, kcal, protein,
    time: new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
  });
  closeSheet();
  renderKcal();
  window.Dashboard && window.Dashboard.render();
}

function openTarget() {
  document.getElementById('sheet-title').textContent = 'Dagligt kaloriemål';
  document.getElementById('sheet-body').innerHTML = `
    <div class="label">Mål (kcal/dag)</div>
    <input type="number" id="kc-target" value="${getTarget()}">
    <button class="btn btn-accent" onclick="Kcal.saveTarget()">Gem</button>
  `;
  openSheet();
}

function saveTarget() {
  const v = parseInt(document.getElementById('kc-target').value) || 2200;
  Store.set(K_TARGET, v);
  closeSheet();
  renderKcal();
}

function shiftDay(delta) {
  const d = new Date(viewDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const next = d.toISOString().split('T')[0];
  if (next > todayISO()) return;
  viewDate = next;
  renderKcal();
}

function remove(id) {
  removeEntry(viewDate, id);
  renderKcal();
  window.Dashboard && window.Dashboard.render();
}

// exposed to global scope for inline onclick handlers + dashboard aggregation
window.Kcal = { openAdd, save, openTarget, saveTarget, shiftDay, remove, getDay, getTarget };

function openSheet() { document.getElementById('sheet-backdrop').classList.add('open'); }
function closeSheet() { document.getElementById('sheet-backdrop').classList.remove('open'); }
