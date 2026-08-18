import { Store } from './storage.js';

let kcalRange = 14;

function mondayOffset(weeksAgo) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day - weeksAgo * 7);
  return monday.toISOString().split('T')[0];
}

function kcalSeries(days) {
  const log = Store.get('kcal_log', {});
  const target = Store.get('kcal_target', 2200);
  const arr = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const entries = log[iso] || [];
    arr.push({ date: iso, total: entries.reduce((s, e) => s + e.kcal, 0) });
  }
  return { arr, target };
}

function strengthSeries(weeks) {
  const sessions = Store.get('strength_sessions', []);
  const arr = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = mondayOffset(i), end = mondayOffset(i - 1);
    const wk = sessions.filter(s => s.date >= start && s.date < end);
    const volume = wk.reduce((sum, s) => sum + s.exercises.reduce((a, e) => a + e.sets.reduce((b, st) => b + (st.reps * st.weight || 0), 0), 0), 0);
    arr.push({ week: start, count: wk.length, volume });
  }
  return arr;
}

function cardioSeries(weeks) {
  const log = Store.get('cardio_log', []);
  const arr = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = mondayOffset(i), end = mondayOffset(i - 1);
    const wk = log.filter(e => e.date >= start && e.date < end);
    arr.push({ week: start, km: wk.reduce((s, e) => s + e.distance_km, 0) });
  }
  return arr;
}

function barChart(data, valueKey, { h = 100, barColor = 'var(--accent)', target = null } = {}) {
  const w = 320;
  const max = Math.max(1, target || 0, ...data.map(d => d[valueKey]));
  const bw = w / data.length;
  let bars = '';
  if (target) {
    const ty = h - (target / max) * (h - 14);
    bars += `<line x1="0" y1="${ty}" x2="${w}" y2="${ty}" stroke="var(--ink-faint)" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  data.forEach((d, i) => {
    const val = d[valueKey];
    const bh = max ? (val / max) * (h - 14) : 0;
    const x = i * bw + bw * 0.22;
    const bwidth = bw * 0.56;
    const y = h - bh;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bwidth.toFixed(1)}" height="${bh.toFixed(1)}" rx="2.5" fill="${barColor}"/>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">${bars}</svg>`;
}

function trendNote(current, previous, unit = '') {
  if (previous === 0 && current === 0) return '';
  const diff = current - previous;
  const pct = previous ? Math.round((diff / previous) * 100) : 100;
  const up = diff >= 0;
  const cls = up ? '' : 'down';
  const arrow = up ? '↑' : '↓';
  return `<span class="progress-note ${cls}">${arrow} ${Math.abs(pct)}% vs. ugen før</span>`;
}

export function renderStats() {
  const { arr: kArr, target } = kcalSeries(kcalRange);
  const kcalAvg = Math.round(kArr.reduce((s, d) => s + d.total, 0) / kArr.filter(d => d.total > 0).length || 0);
  const kcalDaysLogged = kArr.filter(d => d.total > 0).length;

  const sArr = strengthSeries(8);
  const thisWeekVol = sArr[sArr.length - 1].volume, lastWeekVol = sArr[sArr.length - 2].volume;
  const totalSessions8w = sArr.reduce((s, w) => s + w.count, 0);

  const cArr = cardioSeries(8);
  const thisWeekKm = cArr[cArr.length - 1].km, lastWeekKm = cArr[cArr.length - 2].km;
  const totalKm8w = cArr.reduce((s, w) => s + w.km, 0);

  const html = `
  <div class="card">
    <div class="card-row"><h2 style="margin:0">Kalorier</h2>
      <div class="pill-group" style="margin-top:0">
        <button class="btn-sm ${kcalRange===7?'active':''}" onclick="Stats.setKcalRange(7)">7d</button>
        <button class="btn-sm ${kcalRange===14?'active':''}" onclick="Stats.setKcalRange(14)">14d</button>
        <button class="btn-sm ${kcalRange===30?'active':''}" onclick="Stats.setKcalRange(30)">30d</button>
      </div>
    </div>
    ${barChart(kArr, 'total', { barColor: 'var(--accent)', target })}
    <div class="stats-grid" style="margin-top:10px">
      <div class="stat"><div class="val">${kcalAvg||0}</div><div class="lbl">Snit/dag</div></div>
      <div class="stat"><div class="val">${target}</div><div class="lbl">Mål</div></div>
      <div class="stat"><div class="val">${kcalDaysLogged}/${kcalRange}</div><div class="lbl">Dage logget</div></div>
    </div>
  </div>

  <div class="card">
    <h2>Styrketræning · 8 uger</h2>
    ${barChart(sArr, 'volume', { barColor: 'var(--info)' })}
    <div class="stats-grid" style="margin-top:10px">
      <div class="stat"><div class="val">${sArr[sArr.length-1].count}</div><div class="lbl">Denne uge</div></div>
      <div class="stat"><div class="val">${totalSessions8w}</div><div class="lbl">Total 8 uger</div></div>
      <div class="stat"><div class="val">${Math.round(thisWeekVol/1000*10)/10}t</div><div class="lbl">Volumen (ton)</div></div>
    </div>
    <div style="margin-top:8px">${trendNote(thisWeekVol, lastWeekVol)}</div>
  </div>

  <div class="card">
    <h2>Løb/Cykel · 8 uger</h2>
    ${barChart(cArr, 'km', { barColor: 'var(--good)' })}
    <div class="stats-grid" style="margin-top:10px">
      <div class="stat"><div class="val">${thisWeekKm.toFixed(1)}</div><div class="lbl">Km denne uge</div></div>
      <div class="stat"><div class="val">${totalKm8w.toFixed(1)}</div><div class="lbl">Km i alt</div></div>
      <div class="stat"><div class="val">${(totalKm8w/8).toFixed(1)}</div><div class="lbl">Snit/uge</div></div>
    </div>
    <div style="margin-top:8px">${trendNote(thisWeekKm, lastWeekKm)}</div>
  </div>`;

  document.getElementById('view-stats').innerHTML = html;
}

function setKcalRange(n) {
  kcalRange = n;
  renderStats();
}

window.Stats = { setKcalRange };
