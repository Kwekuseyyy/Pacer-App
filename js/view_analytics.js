/* ============================================================
   ANALYTICS — score/accuracy breakdowns, pacing, P+ comparison
   ============================================================ */
function viewAnalytics(mount){
  const history = getHistory().filter(r=>r.finishedAt);
  if(history.length === 0){
    mount.innerHTML = `<section class="container"><h2 class="section-title">Performance analytics</h2>
      <p class="section-sub">Finish a section, custom set, or redrill to see analytics here.</p></section>`;
    return;
  }

  // gather all attempts (flattened) across finished sessions
  const attempts = [];
  for(const rec of history){
    for(const key of rec.qkeys){
      const a = rec.answers[key];
      const q = qFromKey(key);
      if(!a || q.answer == null) continue;
      attempts.push({ q, a, correct: a.picked === q.answer, finishedAt: rec.finishedAt, mode: rec.mode });
    }
  }

  mount.innerHTML = `
    <section class="container">
      <h2 class="section-title">Performance analytics</h2>
      <p class="section-sub">${history.length} sessions completed &middot; ${attempts.length} scored questions</p>

      <div class="analytics-grid">
        <div class="card panel">
          <h3>Accuracy by question type</h3>
          <div id="accByType"></div>
        </div>
        <div class="card panel">
          <h3>Score by section</h3>
          <div id="scoreBySection"></div>
        </div>
        <div class="card panel">
          <h3>Accuracy: easy vs hard (P+)</h3>
          <div id="pplusChart"></div>
        </div>
        <div class="card panel wide">
          <h3>Time per question, most recent session</h3>
          <div id="timeDist"></div>
        </div>
        <div class="card panel wide">
          <h3>Pacing trend across sections completed</h3>
          <div id="pacingTrend"></div>
        </div>
      </div>
    </section>`;

  renderAccByType(attempts);
  renderScoreBySection(history);
  renderPplusChart(attempts);
  renderTimeDist(history);
  renderPacingTrend(history);
}

function barRow(label, pct, sub){
  return `<div class="bar-row">
    <span class="bar-label">${esc(label)}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,pct)}%"></div></div>
    <span class="bar-val mono">${sub}</span>
  </div>`;
}

function renderAccByType(attempts){
  const types = ['SC','RC','QC','PS','CR'];
  const html = types.map(t=>{
    const rows = attempts.filter(a=>a.q.type===t);
    if(!rows.length) return '';
    const acc = Math.round(100*rows.filter(r=>r.correct).length/rows.length);
    return barRow(t, acc, `${acc}% (${rows.length})`);
  }).join('');
  document.getElementById('accByType').innerHTML = html || `<p class="mut">Not enough data yet.</p>`;
}

function renderScoreBySection(history){
  const secRecords = history.filter(r=>r.mode==='section' && r.score.scorable);
  const rows = secRecords.slice(-8).map(r=>{
    const pct = Math.round(100*r.score.correct/r.score.scorable);
    return barRow(`T${r.test} ${r.sid}`, pct, `${pct}%`);
  }).join('');
  document.getElementById('scoreBySection').innerHTML = rows || `<p class="mut">No full sections completed yet.</p>`;
}

function renderPplusChart(attempts){
  const buckets = [[0,40,'Hard (P+ 0-40)'],[40,70,'Medium (P+ 40-70)'],[70,101,'Easy (P+ 70-100)']];
  const html = buckets.map(([lo,hi,label])=>{
    const rows = attempts.filter(a=>a.q.pplus!=null && a.q.pplus>=lo && a.q.pplus<hi);
    if(!rows.length) return barRow(label, 0, '—');
    const acc = Math.round(100*rows.filter(r=>r.correct).length/rows.length);
    return barRow(label, acc, `${acc}% (${rows.length})`);
  }).join('');
  document.getElementById('pplusChart').innerHTML = html;
}

function renderTimeDist(history){
  const last = history.filter(r=>r.mode==='section' || r.mode==='custom').slice(-1)[0];
  const el = document.getElementById('timeDist');
  if(!last){ el.innerHTML = `<p class="mut">No timed session yet.</p>`; return; }
  const times = last.qkeys.map((k,i)=> ({i:i+1, sec: (last.answers[k]?.timeMs||0)/1000}));
  const max = Math.max(1, ...times.map(t=>t.sec));
  el.innerHTML = `<div class="time-bars">${times.map(t=>`
    <div class="time-bar-wrap" title="Q${t.i}: ${Math.round(t.sec)}s">
      <div class="time-bar" style="height:${Math.max(4, 100*t.sec/max)}%"></div>
    </div>`).join('')}</div>
    <p class="mut" style="margin-top:8px; font-size:12.5px;">${esc(last.label)} &middot; ${fmtDate(last.finishedAt)}</p>`;
}

function renderPacingTrend(history){
  const secRecords = history.filter(r=> (r.mode==='section'||r.mode==='custom') && r.elapsedSec>0).slice(-12);
  const el = document.getElementById('pacingTrend');
  if(secRecords.length < 2){ el.innerHTML = `<p class="mut">Complete a few more timed sessions to see a pacing trend.</p>`; return; }
  const points = secRecords.map(r=>{
    const n = r.qkeys.length;
    const avgSecPerQ = r.elapsedSec / n;
    return avgSecPerQ;
  });
  const max = Math.max(...points), min = Math.min(...points);
  const w = 640, h = 140, pad = 12;
  const norm = v => h - pad - ( (v-min)/((max-min)||1) )*(h-2*pad);
  const pts = points.map((v,i)=> `${pad + i*((w-2*pad)/(points.length-1))},${norm(v)}`).join(' ');
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:${h}px;">
    <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((v,i)=>`<circle cx="${pad + i*((w-2*pad)/(points.length-1))}" cy="${norm(v)}" r="3.5" fill="var(--ink)"/>`).join('')}
  </svg>
  <p class="mut" style="font-size:12.5px; margin-top:4px;">Average seconds spent per question, most recent ${points.length} timed sessions. Rising line = rushing more at the end / slowing down over time.</p>`;
}
