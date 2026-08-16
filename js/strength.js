import { Store, todayISO, uid, fmtDateShort } from './storage.js';

const K_TEMPLATES = 'strength_templates'; // [{id,name,exercises:[{id,name}]}]
const K_SESSIONS = 'strength_sessions';   // [{id,date,templateId,templateName,exercises:[{exerciseId,name,sets:[{reps,weight}]}]}]

let activeSession = null; // in-progress session while logging
let draftExercises = [];  // used when building a new template
let draftName = '';       // template name draft, preserved across re-renders

function getTemplates() { return Store.get(K_TEMPLATES, []); }
function getSessions() { return Store.get(K_SESSIONS, []); }

function lastSetsFor(exerciseName) {
  const sessions = getSessions().slice().reverse();
  for (const s of sessions) {
    const ex = s.exercises.find(e => e.name === exerciseName);
    if (ex && ex.sets.length) return ex.sets;
  }
  return null;
}

export function renderStrength() {
  const templates = getTemplates();
  const sessions = getSessions().slice().reverse().slice(0, 8);

  let html = `
  <div class="card">
    <div class="card-row"><h2 style="margin:0">Skabeloner</h2>
      <button class="btn-sm" onclick="Strength.openNewTemplate()">+ Ny</button>
    </div>
    ${templates.length === 0 ? `<div class="empty"><div class="ic">🏋️</div>Opret din første skabelon</div>` :
      templates.map(t => `
        <div class="row">
          <div><div class="rt">${t.name}</div><div class="rs">${t.exercises.length} øvelser</div></div>
          <div style="display:flex;gap:6px">
            <button class="btn-sm" onclick="Strength.startSession('${t.id}')">Start</button>
            <button class="swipe-del" onclick="Strength.deleteTemplate('${t.id}')">✕</button>
          </div>
        </div>`).join('')}
  </div>

  <div class="card">
    <h2>Seneste træninger</h2>
    ${sessions.length === 0 ? `<div class="empty"><div class="ic">📋</div>Ingen træninger endnu</div>` :
      sessions.map(s => {
        const totalSets = s.exercises.reduce((a,e)=>a+e.sets.length,0);
        return `<div class="row" onclick="Strength.viewSession('${s.id}')" style="cursor:pointer">
          <div><div class="rt">${s.templateName}</div><div class="rs">${fmtDateShort(s.date)} · ${s.exercises.length} øvelser · ${totalSets} sæt</div></div>
          <div class="rs">›</div>
        </div>`;
      }).join('')}
  </div>`;

  document.getElementById('view-strength').innerHTML = html;
}

// ---------- New template ----------
function openNewTemplate() {
  draftExercises = [];
  draftName = '';
  renderTemplateSheet();
  openSheet();
  document.getElementById('tpl-name').focus();
}

function renderTemplateSheet() {
  document.getElementById('sheet-title').textContent = 'Ny skabelon';
  document.getElementById('sheet-body').innerHTML = `
    <div class="label">Navn på skabelon</div>
    <input type="text" id="tpl-name" placeholder="fx Overkrop A" value="${draftName}" oninput="Strength.updateDraftName(this.value)">
    <div class="label">Øvelser</div>
    <div id="tpl-ex-list">
      ${draftExercises.map((e,i) => `
        <div class="row"><div class="rt">${e.name}</div>
        <button class="swipe-del" onclick="Strength.removeDraftExercise(${i})">✕</button></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <input type="text" id="tpl-new-ex" placeholder="fx Bænkpres" style="flex:1">
      <button class="btn-sm" onclick="Strength.addDraftExercise()" style="flex-shrink:0">Tilføj</button>
    </div>
    <button class="btn btn-accent" onclick="Strength.saveTemplate()">Gem skabelon</button>
  `;
}

function updateDraftName(v) {
  draftName = v;
}

function addDraftExercise() {
  const input = document.getElementById('tpl-new-ex');
  const name = input.value.trim();
  if (!name) return;
  draftExercises.push({ id: uid(), name });
  input.value = '';
  renderTemplateSheet();
  document.getElementById('tpl-new-ex').focus();
}

function removeDraftExercise(i) {
  draftExercises.splice(i, 1);
  renderTemplateSheet();
}

function saveTemplate() {
  const name = draftName.trim();
  if (!name || draftExercises.length === 0) return;
  Store.update(K_TEMPLATES, [], list => {
    list.push({ id: uid(), name, exercises: draftExercises });
    return list;
  });
  closeSheet();
  renderStrength();
}

function deleteTemplate(id) {
  Store.update(K_TEMPLATES, [], list => list.filter(t => t.id !== id));
  renderStrength();
}

// ---------- Logging a session ----------
function startSession(templateId) {
  const t = getTemplates().find(t => t.id === templateId);
  if (!t) return;
  activeSession = {
    id: uid(), date: todayISO(), templateId: t.id, templateName: t.name,
    exercises: t.exercises.map(ex => {
      const last = lastSetsFor(ex.name);
      const sets = last ? last.map(s => ({ reps: s.reps, weight: s.weight })) : [{ reps: '', weight: '' }];
      return { exerciseId: ex.id, name: ex.name, sets, lastSets: last };
    })
  };
  renderLogView();
}

function renderLogView() {
  const s = activeSession;
  let html = `
  <div class="card">
    <div class="card-row"><h2 style="margin:0">${s.templateName}</h2>
      <button class="btn-sm" onclick="Strength.cancelSession()">Afbryd</button>
    </div>
    <div class="rs">${fmtDateShort(s.date)}</div>
  </div>`;

  s.exercises.forEach((ex, exi) => {
    html += `<div class="card">
      <div class="card-row"><h2 style="margin:0">${ex.name}</h2>
        <button class="btn-sm" onclick="Strength.addSet(${exi})">+ Sæt</button>
      </div>
      ${ex.lastSets ? `<div class="rs" style="margin-bottom:8px">Sidst: ${ex.lastSets.map(x=>`${x.reps}×${x.weight}kg`).join(', ')}</div>` : `<div class="rs" style="margin-bottom:8px">Første gang med denne øvelse</div>`}
      ${ex.sets.map((set, si) => `
        <div class="set-row">
          <div class="idx">${si+1}</div>
          <input type="number" placeholder="reps" value="${set.reps}" onchange="Strength.updateSet(${exi},${si},'reps',this.value)">
          <input type="number" placeholder="kg" value="${set.weight}" onchange="Strength.updateSet(${exi},${si},'weight',this.value)">
          <button class="swipe-del" onclick="Strength.removeSet(${exi},${si})">✕</button>
        </div>`).join('')}
    </div>`;
  });

  html += `<button class="btn btn-accent" onclick="Strength.finishSession()">Afslut træning</button>`;
  document.getElementById('view-strength').innerHTML = html;
}

function addSet(exi) {
  const ex = activeSession.exercises[exi];
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({ reps: last ? last.reps : '', weight: last ? last.weight : '' });
  renderLogView();
}

function removeSet(exi, si) {
  activeSession.exercises[exi].sets.splice(si, 1);
  renderLogView();
}

function updateSet(exi, si, field, value) {
  activeSession.exercises[exi].sets[si][field] = parseFloat(value) || 0;
}

function cancelSession() {
  activeSession = null;
  renderStrength();
}

function finishSession() {
  const s = activeSession;
  s.exercises.forEach(ex => { delete ex.lastSets; });
  Store.update(K_SESSIONS, [], list => { list.push(s); return list; });
  activeSession = null;
  renderStrength();
  window.Dashboard && window.Dashboard.render();
}

function viewSession(id) {
  const s = getSessions().find(s => s.id === id);
  if (!s) return;
  document.getElementById('sheet-title').textContent = s.templateName + ' · ' + fmtDateShort(s.date);
  document.getElementById('sheet-body').innerHTML = s.exercises.map(ex => `
    <div class="label" style="margin-top:14px">${ex.name}</div>
    ${ex.sets.map((set,i) => `<div class="rs">Sæt ${i+1}: ${set.reps} reps × ${set.weight} kg</div>`).join('')}
  `).join('');
  openSheet();
}

window.Strength = {
  openNewTemplate, addDraftExercise, removeDraftExercise, updateDraftName, saveTemplate, deleteTemplate,
  startSession, addSet, removeSet, updateSet, cancelSession, finishSession, viewSession
};

function openSheet() { document.getElementById('sheet-backdrop').classList.add('open'); }
function closeSheet() { document.getElementById('sheet-backdrop').classList.remove('open'); }
