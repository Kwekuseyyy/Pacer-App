/* ============================================================
   MISTAKES ENGINE
   A question is an "open mistake" if its most recent attempt
   (across any section, custom set, or redrill) was wrong or
   left blank. Answering it correctly anywhere — including in
   a redrill — clears it (clear-on-correct).
   ============================================================ */
function latestAttempts(){
  const map = new Map(); // qkey -> {key, finishedAt, picked, ...}
  for(const rec of getHistory()){
    if(!rec.finishedAt) continue;
    for(const key of rec.qkeys){
      const a = rec.answers[key];
      if(!a) continue;
      const prev = map.get(key);
      if(!prev || new Date(rec.finishedAt) >= new Date(prev.finishedAt)){
        map.set(key, { key, finishedAt: rec.finishedAt, picked: a.picked, timeMs: a.timeMs, marked: a.marked });
      }
    }
  }
  return map;
}

function computeMistakes(filters={}){
  const attempts = latestAttempts();
  const out = [];
  for(const [key, a] of attempts){
    const q = qFromKey(key);
    if(q.answer == null) continue; // no key available, can't judge
    const wrong = a.picked !== q.answer;
    if(!wrong) continue;
    out.push({ key, q, attempt: a });
  }
  return applyMistakeFilters(out, filters);
}

function applyMistakeFilters(list, f){
  return list.filter(({q}) => {
    if(f.test && q.test !== f.test) return false;
    if(f.track && trackOf(q.sid) !== f.track) return false;
    if(f.type && q.type !== f.type) return false;
    if(f.diOnly && !q.isDI) return false;
    if(f.pMin != null && (q.pplus == null || q.pplus < f.pMin)) return false;
    if(f.pMax != null && (q.pplus == null || q.pplus > f.pMax)) return false;
    if(f.tag){
      const note = getNote(q.key);
      if(!note || !note.tags.some(t => t.toLowerCase() === f.tag.toLowerCase())) return false;
    }
    return true;
  }).sort((a,b)=> (a.q.pplus??999) - (b.q.pplus??999) || a.q.test-b.q.test);
}

function allNoteTags(){
  const notes = getNotes();
  const tags = new Set();
  Object.values(notes).forEach(n => (n.tags||[]).forEach(t=>tags.add(t)));
  return [...tags].sort();
}

let MISTAKE_FILTERS = {};

function viewMistakes(mount){
  const tags = allNoteTags();
  mount.innerHTML = `
    <section class="container">
      <h2 class="section-title">Mistakes engine</h2>
      <p class="section-sub">Auto-populated from wrong or blank answers. Clears the moment a question is answered correctly — including in a redrill.</p>

      <div class="filter-bar card">
        <div class="filter-field">
          <label>Test</label>
          <select id="fTest"><option value="">Any</option>${allTests().map(t=>`<option value="${t}">Test ${t}</option>`).join('')}</select>
        </div>
        <div class="filter-field">
          <label>Section</label>
          <select id="fTrack"><option value="">Any</option><option value="V">Verbal</option><option value="Q">Quant</option><option value="C">Critical Reasoning</option></select>
        </div>
        <div class="filter-field">
          <label>Question type</label>
          <select id="fType"><option value="">Any</option><option value="SC">SC</option><option value="RC">RC</option><option value="QC">QC</option><option value="PS">PS</option><option value="CR">CR</option></select>
        </div>
        <div class="filter-field">
          <label>P+ range</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" id="fPMin" min="0" max="100" placeholder="0" style="width:64px;"/>
            <span>&ndash;</span>
            <input type="number" id="fPMax" min="0" max="100" placeholder="100" style="width:64px;"/>
          </div>
        </div>
        <div class="filter-field">
          <label>Tag</label>
          <select id="fTag"><option value="">Any</option>${tags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
        </div>
        <label class="check-row" style="align-self:flex-end;"><input type="checkbox" id="fDI"/> Data interpretation only</label>
      </div>

      <div id="mistakeResults"></div>
    </section>`;

  const refs = ['fTest','fTrack','fType','fPMin','fPMax','fTag','fDI'].map(id=>document.getElementById(id));
  refs.forEach(el => el.addEventListener('input', refreshMistakes));
  refreshMistakes();
}

function refreshMistakes(){
  MISTAKE_FILTERS = {
    test: +document.getElementById('fTest').value || null,
    track: document.getElementById('fTrack').value || null,
    type: document.getElementById('fType').value || null,
    pMin: document.getElementById('fPMin').value ? +document.getElementById('fPMin').value : null,
    pMax: document.getElementById('fPMax').value ? +document.getElementById('fPMax').value : null,
    tag: document.getElementById('fTag').value || null,
    diOnly: document.getElementById('fDI').checked,
  };
  const list = computeMistakes(MISTAKE_FILTERS);
  const box = document.getElementById('mistakeResults');
  box.innerHTML = `
    <div class="mistake-toolbar">
      <span><strong>${list.length}</strong> open mistake${list.length===1?'':'s'}</span>
      <button class="btn btn-gold" id="redrillBtn" ${list.length===0?'disabled':''}>Redrill these (untimed)</button>
    </div>
    <table class="review-table">
      <thead><tr><th>Test</th><th>Sec</th><th>Q</th><th>Type</th><th>Your answer</th><th>Correct</th><th>P+</th><th>Last attempt</th><th></th></tr></thead>
      <tbody>
        ${list.map(({key,q,attempt})=>`
          <tr class="row-wrong">
            <td class="mono">T${q.test}</td>
            <td class="mono">${q.sid}</td>
            <td class="mono">${q.q}</td>
            <td>${q.type}${q.isDI?' · DI':''}</td>
            <td class="mono">${attempt.picked||'—'}</td>
            <td class="mono">${q.answer}</td>
            <td class="mono">${q.pplus!=null?q.pplus+'%':'—'}</td>
            <td>${fmtDate(attempt.finishedAt)}</td>
            <td><button class="btn btn-sm btn-ghost" data-view-q="${key}">View</button></td>
          </tr>`).join('') || `<tr><td colspan="9" class="mut" style="text-align:center; padding:24px;">No open mistakes match these filters.</td></tr>`}
      </tbody>
    </table>`;
  box.querySelector('#redrillBtn')?.addEventListener('click', ()=> startRedrill(list.map(x=>x.key)));
  box.querySelectorAll('[data-view-q]').forEach(btn=> btn.addEventListener('click', ()=> openQuestionZoom(btn.getAttribute('data-view-q'))));
}

function startRedrill(qkeys){
  if(!qkeys.length) return;
  const session = {
    id: uid(), mode:'redrill', label:`Redrill: ${qkeys.length} mistake${qkeys.length>1?'s':''}`,
    qkeys, timed:false, allottedSec:0, elapsedSec:0,
    startedAt: new Date().toISOString(), finishedAt:null, cursor:0, answers:{},
  };
  setInProgress(session);
  go({view:'player', session});
}
