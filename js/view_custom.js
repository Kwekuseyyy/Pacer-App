/* ============================================================
   CUSTOM SET BUILDER
   ============================================================ */
const CUSTOM_SIZES = [12,15,20,25,30,35,40,45,50];

function allQuestionsFlat(){
  return [...DATA.questions.values()];
}

function viewCustom(mount){
  const tags = allNoteTags();
  mount.innerHTML = `
    <section class="container">
      <h2 class="section-title">Custom set builder</h2>
      <p class="section-sub">Mix any combination of tests and question types. Timing is fixed at 1&nbsp;minute per question.</p>

      <div class="filter-bar card">
        <div class="filter-field">
          <label>Tests (leave empty = all)</label>
          <select id="cTests" multiple size="6" style="min-width:140px;">
            ${allTests().map(t=>`<option value="${t}">Test ${t}</option>`).join('')}
          </select>
        </div>
        <div class="filter-field">
          <label>Section</label>
          <select id="cTrack"><option value="">Any</option><option value="V">Verbal</option><option value="Q">Quant</option><option value="C">Critical Reasoning</option></select>
        </div>
        <div class="filter-field">
          <label>Question type</label>
          <select id="cType"><option value="">Any</option><option value="SC">SC</option><option value="RC">RC</option><option value="QC">QC</option><option value="PS">PS</option><option value="CR">CR</option></select>
        </div>
        <div class="filter-field">
          <label>P+ range</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <input type="number" id="cPMin" min="0" max="100" placeholder="0" style="width:64px;"/>
            <span>&ndash;</span>
            <input type="number" id="cPMax" min="0" max="100" placeholder="100" style="width:64px;"/>
          </div>
        </div>
        <div class="filter-field">
          <label>Tag</label>
          <select id="cTag"><option value="">Any</option>${tags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
        </div>
        <label class="check-row" style="align-self:flex-end;"><input type="checkbox" id="cDI"/> Data interpretation only</label>
        <label class="check-row" style="align-self:flex-end;"><input type="checkbox" id="cUnseen" checked/> Exclude questions already attempted</label>
      </div>

      <div class="filter-field" style="margin-top:6px;">
        <label>Set size</label>
        <div class="chip-row">
          ${CUSTOM_SIZES.map((n,i)=>`<button class="chip ${i===2?'chip-active':''}" data-size="${n}">${n}</button>`).join('')}
        </div>
      </div>

      <div id="customCount" class="section-sub"></div>
      <button class="btn btn-primary btn-lg" id="customBuild" style="margin-top:10px;">Build &amp; Start Set</button>
    </section>`;

  let size = 20;
  const inputs = ['cTests','cTrack','cType','cPMin','cPMax','cTag','cDI','cUnseen'].map(id=>document.getElementById(id));
  const recompute = ()=>{
    const pool = customPool();
    document.getElementById('customCount').textContent = `${pool.length} question${pool.length===1?'':'s'} match these filters.`;
  };
  inputs.forEach(el => el.addEventListener('input', recompute));
  mount.querySelectorAll('[data-size]').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      mount.querySelectorAll('[data-size]').forEach(c=>c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      size = +chip.getAttribute('data-size');
    });
  });
  recompute();

  document.getElementById('customBuild').addEventListener('click', ()=>{
    const pool = customPool();
    if(pool.length === 0){ alert('No questions match these filters.'); return; }
    const picked = shuffle(pool).slice(0, size);
    const session = {
      id: uid(), mode:'custom', label:`Custom set (${picked.length}Q)`,
      qkeys: picked.map(q=>q.key), timed:true, allottedSec: picked.length*60, elapsedSec:0,
      startedAt: new Date().toISOString(), finishedAt:null, cursor:0, answers:{},
    };
    setInProgress(session);
    go({view:'player', session});
  });
}

function customPool(){
  const testsSel = [...document.getElementById('cTests').selectedOptions].map(o=>+o.value);
  const track = document.getElementById('cTrack').value || null;
  const type = document.getElementById('cType').value || null;
  const pMin = document.getElementById('cPMin').value ? +document.getElementById('cPMin').value : null;
  const pMax = document.getElementById('cPMax').value ? +document.getElementById('cPMax').value : null;
  const tag = document.getElementById('cTag').value || null;
  const diOnly = document.getElementById('cDI').checked;
  const unseen = document.getElementById('cUnseen').checked;
  const attempted = unseen ? latestAttempts() : null;

  return allQuestionsFlat().filter(q=>{
    if(testsSel.length && !testsSel.includes(q.test)) return false;
    if(track && trackOf(q.sid) !== track) return false;
    if(type && q.type !== type) return false;
    if(diOnly && !q.isDI) return false;
    if(pMin != null && (q.pplus==null || q.pplus < pMin)) return false;
    if(pMax != null && (q.pplus==null || q.pplus > pMax)) return false;
    if(tag){
      const note = getNote(q.key);
      if(!note || !note.tags.some(t=>t.toLowerCase()===tag.toLowerCase())) return false;
    }
    if(unseen && attempted.has(q.key)) return false;
    return true;
  });
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
