import { renderDashboard } from './dashboard.js';
import { renderStats } from './stats.js';
import { renderKcal } from './kcal.js';
import { renderStrength } from './strength.js';
import { renderRunning, handleStravaRedirect } from './running.js';
import { renderCooper } from './cooper.js';
import * as Sync from './sync.js';

const renderers = {
  dashboard: renderDashboard,
  stats: renderStats,
  kcal: renderKcal,
  strength: renderStrength,
  running: renderRunning,
  cooper: renderCooper,
};

const titles = {
  dashboard: ['Dashboard', 'Dit overblik i dag'],
  stats: ['Statistik', 'Udvikling over tid'],
  kcal: ['Kalorier', 'Hold styr på dit indtag'],
  strength: ['Styrke', 'Skabeloner og progression'],
  running: ['Løb/Cykel', 'Log ture og synk med Strava'],
  cooper: ['Cooper', 'Målprogram til testen'],
};

function go(tab) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.drawer-item').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + tab).classList.add('active');
  const drawerItem = document.getElementById('drawer-' + tab);
  if (drawerItem) drawerItem.classList.add('active');
  document.getElementById('page-title').textContent = titles[tab][0];
  document.getElementById('page-sub').textContent = titles[tab][1];
  renderers[tab]();
  window.scrollTo(0,0);
  closeDrawer();
}

function openDrawer() { document.getElementById('drawer-backdrop').classList.add('open'); }
function closeDrawer() { document.getElementById('drawer-backdrop').classList.remove('open'); }

window.App = { go, openDrawer, closeDrawer };

function closeSheet() { document.getElementById('sheet-backdrop').classList.remove('open'); }
window.closeSheet = closeSheet;

async function boot() {
  await handleStravaRedirect();
  await Sync.init();
  const startTab = window.location.search.includes('code=') ? 'running' : 'dashboard';
  go(startTab);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

boot();
