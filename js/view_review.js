/* ============================================================
   REVIEW — score report + per-question review table
   ============================================================ */
function viewReview(mount, record){
  const {correct, scorable, unscored, total} = record.score;
  const pct = scorable ? Math.round(100*correct/scorable) : 0;

  mount.innerHTML = `
    <section class="container narrow">
      <div class="score-hero card">
        <div class="score-ring">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--cardline)" stroke-width="10"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gold)" stroke-width="10"
              stroke-dasharray="${2*Math.PI*52}" stroke-dashoffset="${2*Math.PI*52*(1-pct/100)}"
              stroke-linecap="round" transform="rotate(-90 60 60)"/>
          </svg>
          <span class="score-pct mono">${pct}%</span>
        </div>
        <div class="score-copy">
          <h2 style="margin:0 0 4px;">${esc(record.label)}</h2>
          <p style="margin:0; color:var(--mut);">${correct} / ${scorable} scored correctly${unscored? ` &middot; ${unscored} excluded (answer key unavailable)`:''}</p>
          <p style="margin:6px 0 0; color:var(--mut); font-size:13.5px;">Finished ${fmtDate(record.finishedAt)} &middot; ${fmtTime(record.elapsedSec)} used</p>
        </div>
      </div>

      <div class="review-actions">
        <button class="btn" id="toLanding">Home</button>
        ${record.mode==='section' ? `<button class="btn btn-primary" id="retry">Retry this section</button>` : ''}
        <button class="btn btn-gold" id="toMistakes">Review mistakes</button>
      </div>

      <h3 class="section-title" style="margin-top:32px;">Question review</h3>
      <table class="review-table">
        <thead><tr><th>Q</th><th>Type</th><th>Your answer</th><th>Correct</th><th>Time</th><th>P+</th><th></th></tr></thead>
        <tbody>
          ${record.qkeys.map(key => reviewRow(record, key)).join('')}
        </tbody>
      </table>
    </section>`;

  mount.querySelector('#toLanding').addEventListener('click', ()=> { ROUTE_STACK.length=0; go({view:'landing'}); });
  mount.querySelector('#toMistakes').addEventListener('click', ()=> go({view:'mistakes'}));
  mount.querySelector('#retry')?.addEventListener('click', ()=>{
    const sec = getSection(record.test, record.sid);
    go({view:'pretest', test: record.test, sid: record.sid});
  });
  mount.querySelectorAll('[data-view-q]').forEach(btn=>{
    btn.addEventListener('click', ()=> openQuestionZoom(btn.getAttribute('data-view-q')));
  });
}

function reviewRow(record, key){
  const q = qFromKey(key);
  const rec = record.answers[key] || {};
  const picked = rec.picked || '—';
  const noKey = q.answer == null;
  const isCorrect = !noKey && rec.picked === q.answer;
  return `
    <tr class="${noKey?'row-nokey': isCorrect?'row-correct':'row-wrong'}">
      <td class="mono">${q.q}</td>
      <td>${q.type}${q.isDI?' · DI':''}</td>
      <td class="mono">${esc(picked)}</td>
      <td class="mono">${noKey ? '<span class="mut">key unavailable</span>' : q.answer}</td>
      <td class="mono">${fmtTime((rec.timeMs||0)/1000)}</td>
      <td class="mono">${q.pplus!=null ? q.pplus+'%' : '—'}</td>
      <td><button class="btn btn-sm btn-ghost" data-view-q="${key}">View</button></td>
    </tr>`;
}

function openQuestionZoom(key){
  const q = qFromKey(key);
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `
    <div class="modal" style="max-width:760px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="margin:0;">Test ${q.test} &middot; ${q.sid} &middot; Q${q.q}</h3>
        <button class="btn btn-sm btn-ghost" id="zoomClose">Close</button>
      </div>
      ${q.contexts.map(c=>`<img src="${c.path}" style="margin-bottom:10px; border:1px solid var(--cardline); border-radius:8px;"/>`).join('')}
      <img src="${q.img}" style="border:1px solid var(--cardline); border-radius:8px;"/>
      <p style="margin-top:10px; color:var(--mut); font-size:13.5px;">Correct answer: <strong>${q.answer||'unavailable'}</strong>${q.pplus!=null?` &middot; P+ ${q.pplus}%`:''}</p>
    </div>`;
  document.body.appendChild(scrim);
  scrim.querySelector('#zoomClose').addEventListener('click', ()=>scrim.remove());
  scrim.addEventListener('click', e=>{ if(e.target===scrim) scrim.remove(); });
}
