import { Store, todayISO } from './storage.js';

export function renderDashboard() {
  const today = todayISO();

  // Kcal
  const kcalLog = Store.get('kcal_log', {});
  const target = Store.get('kcal_target', 2200);
  const todayEntries = kcalLog[today] || [];
  const kcalToday = todayEntries.reduce((s,e)=>s+e.kcal,0);
  const kcalPct = Math.min(1, target ? kcalToday/target : 0);

  // Strength this week
  const sessions = Store.get('strength_sessions', []);
  const weekStart = mondayISO();
  const strengthThisWeek = sessions.filter(s=>s.date>=weekStart).length;
  const strengthPct = Math.min(1, strengthThisWeek/3);

  // Cardio this week
  const cardio = Store.get('cardio_log', []);
  const cardioThisWeek = cardio.filter(e=>e.date>=weekStart);
  const cardioKm = cardioThisWeek.reduce((s,e)=>s+e.distance_km,0);
  const cardioPct = Math.min(1, cardioKm/20);

  const segments = [
    { pct: kcalPct, color: 'var(--accent)' },
    { pct: strengthPct, color: 'var(--info)' },
    { pct: cardioPct, color: 'var(--good)' },
  ];

  const R = 52, C = 2*Math.PI*R;
  const gap = 6; // degrees gap between segments, approximated via dasharray trick
  let svgArcs = '';
  const arcLen = C/3 - gap;
  segments.forEach((s, i) => {
    const filled = arcLen * s.pct;
    const rotate = i * (360/3);
    svgArcs += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--border)" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${arcLen} ${C-arcLen}" transform="rotate(${rotate} 60 60)"/>`;
    if (filled > 0.5) {
      svgArcs += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${s.color}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${filled} ${C-filled}" transform="rotate(${rotate} 60 60)"/>`;
    }
  });

  const overallPct = Math.round(((kcalPct+strengthPct+cardioPct)/3)*100);

  const html = `
  <div class="card">
    <h2>I dag</h2>
    <div class="load-ring-wrap">
      <div class="load-ring">
        <svg width="120" height="120" viewBox="0 0 120 120">${svgArcs}</svg>
        <div class="center"><div class="n">${overallPct}%</div><div class="t">Ugemål</div></div>
      </div>
      <div class="ring-legend">
        <div class="li"><span class="dot" style="background:var(--accent)"></span>Kalorier: <b>${kcalToday}/${target}</b></div>
        <div class="li"><span class="dot" style="background:var(--info)"></span>Styrke: <b>${strengthThisWeek}/3 uge</b></div>
        <div class="li"><span class="dot" style="background:var(--good)"></span>Løb/cykel: <b>${cardioKm.toFixed(1)}/20 km</b></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-row"><h2 style="margin:0">Genveje</h2></div>
    <div class="pill-group">
      <button class="btn-sm" onclick="App.go('kcal'); Kcal.openAdd()">+ Log måltid</button>
      <button class="btn-sm" onclick="App.go('strength')">Start træning</button>
      <button class="btn-sm" onclick="App.go('running'); Running.openAdd()">+ Log tur</button>
      <button class="btn-sm" onclick="App.go('cooper')">Cooper-program</button>
    </div>
  </div>

  <div class="card">
    <h2>Seneste aktivitet</h2>
    ${renderRecent(todayEntries, sessions, cardio)}
  </div>`;

  document.getElementById('view-dashboard').innerHTML = html;
}

function renderRecent(kcalToday, sessions, cardio) {
  const items = [];
  kcalToday.forEach(e => items.push({ t: e.time || '', label: `🍽️ ${e.name}`, sub: `${e.kcal} kcal` }));
  sessions.slice(-3).reverse().forEach(s => items.push({ t: s.date, label: `🏋️ ${s.templateName}`, sub: `${s.exercises.length} øvelser` }));
  cardio.slice(-3).reverse().forEach(e => items.push({ t: e.date, label: `${e.type==='run'?'🏃':'🚴'} ${e.distance_km} km`, sub: `${e.duration_min} min` }));
  if (items.length === 0) return `<div class="empty"><div class="ic">✨</div>Intet endnu i dag — kom i gang!</div>`;
  return items.slice(0,6).map(i => `<div class="row"><div><div class="rt">${i.label}</div><div class="rs">${i.sub}</div></div><div class="rs">${i.t}</div></div>`).join('');
}

function mondayISO() {
  const now = new Date();
  const day = (now.getDay()+6)%7;
  const monday = new Date(now); monday.setDate(now.getDate()-day);
  return monday.toISOString().split('T')[0];
}

window.Dashboard = { render: renderDashboard };
