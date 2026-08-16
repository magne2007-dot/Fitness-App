import { renderDashboard } from './dashboard.js';
import { renderKcal } from './kcal.js';
import { renderStrength } from './strength.js';
import { renderRunning, handleStravaRedirect } from './running.js';
import { renderCooper } from './cooper.js';

const renderers = {
  dashboard: renderDashboard,
  kcal: renderKcal,
  strength: renderStrength,
  running: renderRunning,
  cooper: renderCooper,
};

const titles = {
  dashboard: ['Dashboard', 'Dit overblik i dag'],
  kcal: ['Kalorier', 'Hold styr på dit indtag'],
  strength: ['Styrke', 'Skabeloner og progression'],
  running: ['Løb/Cykel', 'Log ture og synk med Strava'],
  cooper: ['Cooper', 'Målprogram til testen'],
};

function go(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('page-title').textContent = titles[tab][0];
  document.getElementById('page-sub').textContent = titles[tab][1];
  renderers[tab]();
  window.scrollTo(0,0);
}

window.App = { go };

function closeSheet() { document.getElementById('sheet-backdrop').classList.remove('open'); }
window.closeSheet = closeSheet;

async function boot() {
  await handleStravaRedirect();
  const startTab = window.location.search.includes('code=') ? 'running' : 'dashboard';
  go(startTab);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

boot();
