import { Store } from './storage.js';

const K_SETUP = 'cooper_setup';

function fp(minPerKm){
  const m=Math.floor(minPerKm),s=Math.round((minPerKm-m)*60);
  return m+':'+(s<10?'0':'')+s+' /km';
}

const norms = {
  male:[
    {label:'Fremragende',min:2800,color:'#639922',badge:'b-green'},
    {label:'Over middel',min:2400,color:'#185FA5',badge:'b-blue'},
    {label:'Middel',min:2000,color:'#EF9F27',badge:'b-amber'},
    {label:'Under middel',min:1600,color:'#D85A30',badge:'b-red'},
    {label:'Svag',min:0,color:'#888',badge:'b-gray'},
  ],
  female:[
    {label:'Fremragende',min:2300,color:'#639922',badge:'b-green'},
    {label:'Over middel',min:1900,color:'#185FA5',badge:'b-blue'},
    {label:'Middel',min:1600,color:'#EF9F27',badge:'b-amber'},
    {label:'Under middel',min:1300,color:'#D85A30',badge:'b-red'},
    {label:'Svag',min:0,color:'#888',badge:'b-gray'},
  ]
};

function getRating(dist,gender){
  for(const n of norms[gender]) if(dist>=n.min) return n;
  return norms[gender][norms[gender].length-1];
}

export function renderCooper() {
  const setup = Store.get(K_SETUP, {});
  const el = document.getElementById('view-cooper');
  el.innerHTML = `
  <div class="card" id="cp-setup-card">
    <h2>Opsætning</h2>
    <div class="label">Køn</div>
    <select id="cp-gender"><option value="male">Mand</option><option value="female">Kvinde</option></select>
    <div class="label">Alder</div>
    <input type="number" id="cp-age" placeholder="fx 20" min="10" max="80">
    <div class="label">Nuværende distance (meter)</div>
    <input type="number" id="cp-cur-dist" placeholder="fx 2200" oninput="Cooper.updateGoalSuggestions()">
    <div class="label">Målsætning (meter)</div>
    <input type="number" id="cp-goal-dist" placeholder="fx 2800">
    <div id="cp-goal-suggestions" class="pill-group"></div>
    <div class="label">Testdato (hvornår skal du tage Cooper-testen?)</div>
    <input type="date" id="cp-test-date">
    <div id="cp-weeks-preview" style="font-size:12px;color:var(--ink-soft);margin-top:6px;display:none"></div>
    <div class="label">Løbedage pr. uge</div>
    <select id="cp-plan-days"><option value="2">2 dage</option><option value="3" selected>3 dage</option><option value="4">4 dage</option></select>
    <button class="btn btn-accent" onclick="Cooper.generatePlan()">Generer mit program</button>
  </div>
  <div id="cp-plan-area"></div>`;

  document.getElementById('cp-gender').value = setup.gender || 'male';
  document.getElementById('cp-age').value = setup.age || '';
  document.getElementById('cp-cur-dist').value = setup.curDist || '';
  document.getElementById('cp-goal-dist').value = setup.goalDist || '';
  document.getElementById('cp-plan-days').value = setup.days || '3';

  if (setup.testDate) {
    document.getElementById('cp-test-date').value = setup.testDate;
  } else {
    const d = new Date(); d.setDate(d.getDate() + 56);
    document.getElementById('cp-test-date').value = d.toISOString().split('T')[0];
  }

  document.getElementById('cp-cur-dist').addEventListener('input', updateGoalSuggestions);
  ['cp-test-date','cp-goal-dist','cp-cur-dist'].forEach(id=>{
    document.getElementById(id).addEventListener('input', updateWeeksPreview);
  });

  updateGoalSuggestions();

  if (setup.hasPlan) generatePlan();
}

function updateGoalSuggestions(){
  const dist = parseInt(document.getElementById('cp-cur-dist').value)||0;
  const gender = document.getElementById('cp-gender').value;
  const table = norms[gender];
  const el = document.getElementById('cp-goal-suggestions');
  if(!dist){el.innerHTML='';return;}
  const curRating = getRating(dist,gender);
  const curIdx = table.findIndex(n=>n.label===curRating.label);
  const suggestions = [];
  if(curIdx>0) suggestions.push({label:table[curIdx-1].label, dist:table[curIdx-1].min});
  if(curIdx>1) suggestions.push({label:table[curIdx-2].label, dist:table[curIdx-2].min});
  suggestions.push({label:'+200m', dist:dist+200});
  suggestions.push({label:'+400m', dist:dist+400});
  el.innerHTML = suggestions.map(s=>`<button class="btn-sm" onclick="Cooper.setGoal(${s.dist})">${s.label}: ${s.dist}m</button>`).join('');
  updateWeeksPreview();
}

function setGoal(d){
  document.getElementById('cp-goal-dist').value=d;
  updateWeeksPreview();
}

function updateWeeksPreview(){
  const testDate = document.getElementById('cp-test-date').value;
  const cur = parseInt(document.getElementById('cp-cur-dist').value)||0;
  const goal = parseInt(document.getElementById('cp-goal-dist').value)||0;
  const el = document.getElementById('cp-weeks-preview');
  if(!testDate||!cur){el.style.display='none';return;}
  const today = new Date();
  const test = new Date(testDate);
  const diffDays = Math.round((test-today)/(1000*60*60*24));
  const weeks = Math.max(1,Math.floor(diffDays/7));
  const needed = goal-cur;
  el.style.display='block';
  el.innerHTML=`📅 ${weeks} uger til testen · ${diffDays} dage · Skal forbedre ${needed>0?'+'+needed:needed}m`;
}

function generatePlan(){
  const gender = document.getElementById('cp-gender').value;
  const age = parseInt(document.getElementById('cp-age').value)||22;
  const cur = parseInt(document.getElementById('cp-cur-dist').value);
  const goal = parseInt(document.getElementById('cp-goal-dist').value);
  const testDate = document.getElementById('cp-test-date').value;
  const days = parseInt(document.getElementById('cp-plan-days').value);
  if(!cur||cur<500){document.getElementById('cp-cur-dist').style.borderColor='var(--accent)';return;}
  if(!goal||goal<cur){document.getElementById('cp-goal-dist').style.borderColor='var(--accent)';return;}
  document.getElementById('cp-cur-dist').style.borderColor='';
  document.getElementById('cp-goal-dist').style.borderColor='';

  Store.set(K_SETUP, { gender, age, curDist: cur, goalDist: goal, testDate, days, hasPlan: true });

  let totalWeeks = 8;
  let testDateStr = testDate;
  if(testDate){
    const today=new Date(), test=new Date(testDate);
    const diffDays=Math.round((test-today)/(1000*60*60*24));
    totalWeeks=Math.max(2,Math.floor(diffDays/7));
  }

  const improvement = goal - cur;
  const weeklyGain = improvement / totalWeeks;

  const goalPaceMin = 1000/(goal/12);
  const curPaceMin  = 1000/(cur/12);
  const ep   = curPaceMin * 1.22;
  const tp   = goalPaceMin * 1.02;
  const ip   = goalPaceMin * 0.93;
  const ip2  = goalPaceMin * 0.88;

  const curRating  = getRating(cur, gender);
  const goalRating = getRating(goal, gender);
  const vo2cur  = Math.round(((cur-504.9)/44.73)*10)/10;
  const vo2goal = Math.round(((goal-504.9)/44.73)*10)/10;
  const pct = Math.min(100, Math.round(cur/goal*100));

  const dayNames=['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  const slots={2:[1,4],3:[1,3,5],4:[1,2,4,5]};
  const sl=slots[days];
  const badgeMap={easy:'b-blue',interval:'b-red',tempo:'b-amber',test:'b-green',rest:'b-gray'};
  const badgeLbl={easy:'Rolig',interval:'Intervaller',tempo:'Tempo',test:'Test',rest:'Hvile'};

  function buildWeek(w, total){
    const progress = w/total;
    const isDeload = total>=6 && (w===Math.floor(total/2)||w===total-1);
    const isTaper  = w>=total-1;
    const isTest   = w===total;
    const intCount = Math.round(6 + progress*6);
    const thirtyFifteen = Math.round(8 + progress*7);

    if(isTest) return [
      {title:'Let løb 15 min', detail:`${fp(ep)} · gem energi`, type:'easy'},
      {title:'4×100m aktivering', detail:'Høj fart · kort · varm op til test', type:'interval'},
      {title:'Hvil', detail:'Spis og sov godt', type:'rest'},
      {title:'🏁 COOPER TEST', detail:`Mål: ${goal}m · Varm op 10 min · løb 12 min FULL GAS`, type:'test'},
    ];
    if(isTaper) return [
      {title:'Let løb 20 min', detail:`${fp(ep)} · meget let`, type:'easy'},
      {title:`6×200m aktivering`, detail:'Hurtigt men kort · hold benene skarpe', type:'interval'},
      {title:'Tempoløb 15 min', detail:`${fp(tp)} · let taper`, type:'tempo'},
      {title:'Hvil', detail:'Gem benet til testen', type:'rest'},
    ];
    if(isDeload) return [
      {title:'Let løb 20 min', detail:`${fp(ep)} · deload uge · kroppen absorberer`, type:'easy'},
      {title:'5×200m', detail:'Hurtigt men kort', type:'interval'},
      {title:'Let løb 20 min', detail:`${fp(ep)}`, type:'easy'},
      {title:'Hvil', type:'rest', detail:''},
    ];
    if(progress<0.25) return [
      {title:`Roligt løb ${20+Math.round(progress*20)} min`, detail:`${fp(ep)} · byg fundamentet`, type:'easy'},
      {title:`${thirtyFifteen}×30/15 sek`, detail:`30 sek MAX · 15 sek pause · Rønnestad-metoden`, type:'interval'},
      {title:`Roligt løb ${25+Math.round(progress*15)} min`, detail:`${fp(ep)}`, type:'easy'},
      {title:`6×400m`, detail:`${fp(ip)} · 400m jog pause · hurtigere end dit mål-pace`, type:'interval'},
    ];
    if(progress<0.5) return [
      {title:`Roligt løb ${30+Math.round(progress*10)} min`, detail:`${fp(ep)}`, type:'easy'},
      {title:`${thirtyFifteen}×30/15 sek`, detail:`MAX effort · 15 sek pause`, type:'interval'},
      {title:`${Math.round(5+progress*3)}×1km`, detail:`${fp(ip)} · 2 min pause · VO2max stimulus`, type:'interval'},
      {title:`Tempoløb ${Math.round(20+progress*10)} min`, detail:`${fp(tp)} · dit måltempo`, type:'tempo'},
    ];
    if(progress<0.75) return [
      {title:`Roligt løb 30 min`, detail:`${fp(ep)}`, type:'easy'},
      {title:`${intCount}×400m`, detail:`${fp(ip2)} · 300m jog · race-specifik`, type:'interval'},
      {title:`Norwegian 4×4 min`, detail:`4 min ved 90-95% maks puls · 3 min aktiv pause`, type:'interval'},
      {title:`Cooper simulation 12 min`, detail:`Løb ved dit målpace ${fp(goalPaceMin)} · mål distance`, type:'test'},
    ];
    return [
      {title:`Roligt løb 25 min`, detail:`${fp(ep)}`, type:'easy'},
      {title:`${thirtyFifteen}×30/15 sek`, detail:`MAX effort · peak intensitet`, type:'interval'},
      {title:`${Math.round(6+progress*2)}×1km`, detail:`${fp(ip2)} · 90 sek pause`, type:'interval'},
      {title:`Tempoløb 25 min ved målpace`, detail:`${fp(goalPaceMin)} · hold præcist pace`, type:'tempo'},
    ];
  }

  function getPhase(w,total){
    const p=w/total;
    if(p<0.25)return{label:'Fase 1: Fundament',color:'#185FA5',badge:'b-blue'};
    if(p<0.5) return{label:'Fase 2: Intensitet',color:'#D85A30',badge:'b-red'};
    if(p<0.75)return{label:'Fase 3: Konsolidering',color:'#639922',badge:'b-green'};
    return{label:'Fase 4: Peak & Test',color:'#6B21A8',badge:'b-purple'};
  }

  const projDist = Math.round(cur + improvement*0.85);
  let html = `
  <div class="card">
    <h2>Dit mål</h2>
    <div class="stats-grid">
      <div class="stat"><div class="val">${cur}m</div><div class="lbl">Nu</div></div>
      <div class="stat"><div class="val" style="color:#639922">${goal}m</div><div class="lbl">Mål</div></div>
      <div class="stat"><div class="val">${totalWeeks} uger</div><div class="lbl">Program</div></div>
    </div>
    <div class="stats-grid">
      <div class="stat"><div class="val">${fp(curPaceMin)}</div><div class="lbl">Nu pace</div></div>
      <div class="stat"><div class="val" style="color:#639922">${fp(goalPaceMin)}</div><div class="lbl">Mål pace</div></div>
      <div class="stat"><div class="val">+${improvement}m</div><div class="lbl">Forskel</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
      <span>${curRating.label} <span class="badge ${curRating.badge}">${cur}m</span></span>
      <span style="color:#639922">${goalRating.label} <span class="badge ${goalRating.badge}">${goal}m</span></span>
    </div>
    <div class="goal-bar" style="height:10px;background:var(--surface-sunken);border-radius:99px;overflow:hidden">
      <div style="height:100%;border-radius:99px;width:${pct}%;background:${goalRating.color}"></div>
    </div>
    <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;display:flex;justify-content:space-between">
      <span>Du er her (${pct}%)</span><span>Mål: ${goal}m</span>
    </div>
    <div style="margin-top:10px;font-size:12px;color:var(--ink-soft)">VO2max nu: <strong>${vo2cur}</strong> → mål: <strong style="color:#639922">${vo2goal}</strong> ml/kg/min · Ca. <strong>+${Math.round(weeklyGain)}m/uge</strong> nødvendigt</div>
    ${testDateStr?`<div style="margin-top:6px;font-size:12px;color:var(--ink-soft)">📅 Testdato: <strong>${new Date(testDateStr).toLocaleDateString('da-DK',{day:'numeric',month:'long',year:'numeric'})}</strong></div>`:''}
  </div>`;

  html += '<div class="timeline" style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:12px">';
  for(let w=1;w<=totalWeeks;w++){
    const ph=getPhase(w,totalWeeks);
    html+=`<div style="height:6px;border-radius:99px;cursor:pointer;flex:1;min-width:16px;background:${ph.color}" title="Uge ${w}" onclick="Cooper.scrollToWeek(${w})"></div>`;
  }
  html+='</div>';

  let lastPhase='';
  for(let w=1;w<=totalWeeks;w++){
    const ph=getPhase(w,totalWeeks);
    const projW=Math.round(cur+(improvement*(w/totalWeeks)));
    const sessions=buildWeek(w,totalWeeks).slice(0,days);
    if(ph.label!==lastPhase){
      lastPhase=ph.label;
      html+=`<div style="padding:6px 0"><span class="phase-label" style="background:${ph.color}22;color:${ph.color};font-size:12px;font-weight:600;padding:6px 10px;border-radius:var(--radius-md);display:inline-block">${ph.label}</span></div>`;
    }
    html+=`<div class="card" id="cp-week-${w}"><div class="week-hdr" style="font-size:11px;font-weight:600;color:var(--ink-soft);margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em;display:flex;justify-content:space-between"><span>Uge ${w}</span><span style="font-size:11px;color:var(--ink-soft)">Forventet: ~${projW}m</span></div>`;
    const wPct=Math.min(100,Math.round(projW/goal*100));
    html+=`<div style="height:3px;background:var(--surface-sunken);border-radius:99px;margin-bottom:10px;overflow:hidden"><div style="height:100%;width:${wPct}%;background:${ph.color};border-radius:99px"></div></div>`;
    for(let i=0;i<7;i++){
      const slotIdx=sl.indexOf(i);
      if(slotIdx!==-1&&sessions[slotIdx]){
        const s=sessions[slotIdx];
        html+=`<div class="day-row" style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)"><div style="width:30px;font-size:12px;font-weight:500;color:var(--ink-soft);flex-shrink:0;padding-top:2px">${dayNames[i]}</div><div><div style="font-size:13px;font-weight:500">${s.title}<span class="badge ${badgeMap[s.type]}">${badgeLbl[s.type]}</span></div><div style="font-size:11px;color:var(--ink-soft);margin-top:2px">${s.detail}</div></div></div>`;
      } else {
        html+=`<div class="day-row" style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--border)"><div style="width:30px;font-size:12px;color:var(--ink-faint);padding-top:2px">${dayNames[i]}</div><div style="font-size:13px;color:var(--ink-soft)">Hvile<span class="badge b-gray">Hvile</span></div></div>`;
      }
    }
    html+='</div>';
  }

  html+=`<div class="card"><h2>Videnskaben bag</h2>
    <div class="tip"><div class="tip-title">Intervalpace baseret på dit mål</div><div class="tip-text">Dine intervalløb er kalibreret til ${fp(ip)} — 7% hurtigere end dit Cooper-mål-pace på ${fp(goalPaceMin)}. Du træner kroppen til at klare dit mål, ikke dit nuværende niveau.</div></div>
    <div class="tip"><div class="tip-title">30/15 sek intervaller</div><div class="tip-text">Rønnestad-metoden akkumulerer mere tid over 90% VO2max end lange intervaller. VO2 når ikke at falde i de 15 sek pauser.</div></div>
    <div class="tip"><div class="tip-title">Norwegian 4×4</div><div class="tip-text">4 min ved 90-95% maks puls × 4 runder er dokumenteret som en af de mest effektive VO2max-metoder (Helgerud et al., 2007).</div></div>
    <div class="tip"><div class="tip-title">Forventet fremgang</div><div class="tip-text">Med ${totalWeeks} ugers konsekvent træning er ~+${Math.round(improvement*0.85)}m realistisk — det svarer til VO2max ${vo2cur} → ~${Math.round(((projDist-504.9)/44.73)*10)/10} ml/kg/min.</div></div>
  </div>`;

  document.getElementById('cp-plan-area').innerHTML=html;
}

function scrollToWeek(w){
  const el=document.getElementById('cp-week-'+w);
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}

window.Cooper = { updateGoalSuggestions, setGoal, generatePlan, scrollToWeek };
