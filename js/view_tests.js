/* ============================================================
   TEST GRID — 27 test cards for a track
   SECTION SELECT — pick which section within a test
   ============================================================ */
function viewTests(mount, track){
  const tests = allTests();
  mount.innerHTML = `
    <section class="container">
      <button class="crumb" data-back>&larr; All tracks</button>
      <h2 class="section-title">${TRACK_LABEL[track]}</h2>
      <p class="section-sub">Pick a test. Each test has two ${TRACK_SHORT[track].toLowerCase()} sections from the Big Book.</p>
      <div class="test-grid">
        ${tests.map(t => testCard(t, track)).join('')}
      </div>
    </section>`;

  mount.querySelector('[data-back]').addEventListener('click', ()=> go({view:'landing'}));
  mount.querySelectorAll('[data-test]').forEach(el=>{
    el.addEventListener('click', ()=> go({view:'sectionSelect', track, test:+el.getAttribute('data-test')}));
  });
}

function testCard(test, track){
  const secs = DATA.testIndex.get(test)[track];
  const doneCount = secs.filter(s => historyForSection(test, s.sid).some(r=>r.finishedAt)).length;
  const bestPct = Math.max(0, ...secs.flatMap(s => historyForSection(test,s.sid).filter(r=>r.finishedAt).map(scorePct)));
  return `
    <button class="test-card" data-test="${test}">
      <span class="test-num">T${String(test).padStart(2,'0')}</span>
      <span class="test-progress-dots">
        ${secs.map(s => `<i class="dot ${historyForSection(test,s.sid).some(r=>r.finishedAt) ? 'done':''}"></i>`).join('')}
      </span>
      ${doneCount>0 ? `<span class="test-best">${bestPct}%</span>` : `<span class="test-best mut">&mdash;</span>`}
    </button>`;
}

function scorePct(record){
  if(!record.score || !record.score.scorable) return 0;
  return Math.round(100 * record.score.correct / record.score.scorable);
}

function viewSectionSelect(mount, track, test){
  const secs = DATA.testIndex.get(test)[track].slice().sort((a,b)=>a.sid.localeCompare(b.sid));
  mount.innerHTML = `
    <section class="container">
      <button class="crumb" data-back>&larr; ${TRACK_LABEL[track]}</button>
      <h2 class="section-title">Test ${test} &mdash; ${TRACK_LABEL[track]}</h2>
      <div class="sec-list">
        ${secs.map((s,i) => sectionRow(s,i)).join('')}
      </div>
    </section>`;

  mount.querySelector('[data-back]').addEventListener('click', ()=> go({view:'tests', track}));
  mount.querySelectorAll('[data-sid]').forEach(el=>{
    el.addEventListener('click', ()=> go({view:'pretest', test, sid: el.getAttribute('data-sid')}));
  });
}

function sectionRow(sec, i){
  const hist = historyForSection(sec.test, sec.sid).filter(r=>r.finishedAt);
  const last = hist[hist.length-1];
  const diCount = sec.questions.filter(qo => getQuestion(sec.test,sec.sid,qo.q).isDI).length;
  return `
    <button class="sec-row" data-sid="${sec.sid}">
      <div class="sec-row-main">
        <span class="sec-row-title">Section ${i+1}</span>
        <span class="sec-row-meta">${sec.n} questions${sec.kind==='quant' && diCount ? ` · ${diCount} data interpretation` : ''}${sec.pmap_uncertain ? ' · passage mapping unverified' : ''}</span>
      </div>
      <div class="sec-row-right">
        ${last ? `<span class="pill" style="background:var(--greensoft); color:var(--green);">${scorePct(last)}% last try</span>` : `<span class="pill" style="background:var(--cardline); color:var(--mut);">Not started</span>`}
        <span class="chev">&rsaquo;</span>
      </div>
    </button>`;
}
