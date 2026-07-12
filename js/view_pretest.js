/* ============================================================
   PRETEST — timing picker before entering the player
   ============================================================ */
const PERQ_MIN = { verbal: 1.5, quant: 1.0, cr: 2.0 };

function defaultMinutes(sec){
  const raw = sec.n * PERQ_MIN[sec.kind];
  return Math.max(5, Math.round(raw/1)); // nearest minute
}

function viewPretest(mount, test, sid){
  const sec = getSection(test, sid);
  const track = trackOf(sid);
  const def = defaultMinutes(sec);
  const chips = [...new Set([20,25,27,30,35,40,45,def])].sort((a,b)=>a-b);
  const hist = historyForSection(test, sid).filter(r=>r.finishedAt);

  mount.innerHTML = `
    <section class="container narrow">
      <button class="crumb" data-back>&larr; Test ${test}</button>
      <h2 class="section-title">${TRACK_LABEL[track]} &middot; Test ${test}</h2>
      <p class="section-sub">${sec.n} questions${sec.kind==='quant' ? ' · calculator not permitted' : ''}${sec.pmap_uncertain ? ' · passage/question mapping is unverified for this section — all passages will be shown as a fallback' : ''}</p>

      <div class="card pretest-card">
        <label class="field-label">Time limit</label>
        <div class="chip-row">
          ${chips.map(m => `<button class="chip ${m===def?'chip-default':''}" data-min="${m}">${m}<span class="chip-unit">min</span></button>`).join('')}
        </div>
        <div class="chip-custom">
          <label for="customMin">Custom:</label>
          <input type="number" id="customMin" min="5" max="90" value="${def}" />
          <span>min</span>
        </div>

        <label class="field-label" style="margin-top:18px;">Options</label>
        <label class="check-row"><input type="checkbox" id="untimed" /> Untimed practice (no lock at time-up)</label>

        ${hist.length ? `<p class="prior-note">You've completed this section ${hist.length} time${hist.length>1?'s':''}. Best score: ${Math.max(...hist.map(scorePct))}%.</p>` : ''}

        <button class="btn btn-primary btn-lg" id="startBtn" style="margin-top:22px;">Start Section</button>
      </div>
    </section>`;

  let chosen = def;
  mount.querySelector('[data-back]').addEventListener('click', ()=> go({view:'sectionSelect', track, test}));
  const customInput = mount.querySelector('#customMin');
  mount.querySelectorAll('.chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      mount.querySelectorAll('.chip').forEach(c=>c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      chosen = +chip.getAttribute('data-min');
      customInput.value = chosen;
    });
  });
  mount.querySelector(`.chip[data-min="${def}"]`)?.classList.add('chip-active');
  customInput.addEventListener('input', ()=>{
    chosen = +customInput.value || def;
    mount.querySelectorAll('.chip').forEach(c=>c.classList.remove('chip-active'));
  });

  mount.querySelector('#startBtn').addEventListener('click', ()=>{
    const untimed = mount.querySelector('#untimed').checked;
    const session = createSectionSession(sec, untimed ? 0 : chosen*60);
    setInProgress(session);
    go({view:'player', session}, {replace:true});
  });
}

function createSectionSession(sec, allottedSec){
  const qkeys = sectionQuestionKeys(sec);
  return {
    id: uid(), mode:'section', test:sec.test, sid:sec.sid, kind:sec.kind,
    label: `Test ${sec.test} — ${TRACK_LABEL[trackOf(sec.sid)]}`,
    qkeys, timed: allottedSec>0, allottedSec, elapsedSec:0,
    startedAt: new Date().toISOString(), finishedAt:null,
    cursor:0, answers:{},
  };
}
