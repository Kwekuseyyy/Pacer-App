/* ============================================================
   LANDING — hero + three-track selector + quick stats
   ============================================================ */
function viewLanding(mount){
  const history = getHistory().filter(r=>r.finishedAt);
  const testsSeen = new Set(history.filter(r=>r.mode==='section').map(r=>r.test));
  const totalMistakesOpen = openMistakes().length;

  mount.innerHTML = `
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">27 tests · 2,930 questions · ETS Big Book</p>
          <h1>Pace the book<br/>the way the test paces you.</h1>
          <p class="hero-sub">Timed sections, honest scoring, and a mistakes engine that keeps
            pulling your weak spots back until they're not weak anymore.</p>
          <div class="hero-stats">
            <div><strong>${testsSeen.size}</strong><span>/27 tests started</span></div>
            <div><strong>${history.length}</strong><span>sections completed</span></div>
            <div><strong>${totalMistakesOpen}</strong><span>mistakes open</span></div>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">${heroSVG()}</div>
      </div>
    </section>

    <section class="container">
      <h2 class="section-title">Choose a track</h2>
      <div class="track-grid">
        ${trackCard('V','Verbal Reasoning','Sentence completion &amp; reading comprehension.')}
        ${trackCard('Q','Quantitative Reasoning','Quant comparison, problem solving &amp; data interpretation.')}
        ${trackCard('C','Critical Reasoning','Standalone logical reasoning, GMAT-style pacing.')}
      </div>
    </section>

    <section class="container quicklinks">
      <button class="qlink" data-nav="mistakes">
        <span class="qlink-title">Mistakes engine</span>
        <span class="qlink-sub">${totalMistakesOpen} open · redrill by test, type or difficulty</span>
      </button>
      <button class="qlink" data-nav="custom">
        <span class="qlink-title">Build a custom set</span>
        <span class="qlink-sub">Mix tests &amp; types, 12&ndash;50 questions, 1&nbsp;min/question</span>
      </button>
      <button class="qlink" data-nav="analytics">
        <span class="qlink-title">Performance analytics</span>
        <span class="qlink-sub">Accuracy, pacing trend, P+ comparison</span>
      </button>
    </section>
  `;

  mount.querySelectorAll('[data-track]').forEach(el=>{
    el.addEventListener('click', ()=> go({view:'tests', track: el.getAttribute('data-track')}));
  });
  mount.querySelectorAll('[data-nav]').forEach(el=>{
    el.addEventListener('click', ()=> go({view: el.getAttribute('data-nav')}));
  });

  maybeShowResumeBanner(mount);
  maybeShowExportReminder(mount);
}

function trackCard(track, title, sub){
  const secs = sectionsForTrack(track);
  const tests = new Set(secs.map(s=>s.test));
  const done = getHistory().filter(r=>r.finishedAt && r.mode==='section' && r.sid && r.sid[0]===track).length;
  return `
    <button class="track-card" data-track="${track}">
      <span class="track-glyph track-glyph-${track}">${track}</span>
      <span class="track-name">${title}</span>
      <span class="track-sub">${sub}</span>
      <span class="track-meta">${tests.size} tests · ${secs.length} sections · ${done} done</span>
    </button>`;
}

function heroSVG(){
  return `<svg viewBox="0 0 680 500" width="100%" height="100%" role="presentation">
    <rect x="0" y="0" width="680" height="500" rx="16" fill="#101826"/>
    <g stroke="#1c2740" stroke-width="0.5">
      <line x1="0" y1="40" x2="680" y2="40"/><line x1="0" y1="80" x2="680" y2="80"/><line x1="0" y1="120" x2="680" y2="120"/><line x1="0" y1="160" x2="680" y2="160"/><line x1="0" y1="200" x2="680" y2="200"/><line x1="0" y1="240" x2="680" y2="240"/><line x1="0" y1="280" x2="680" y2="280"/><line x1="0" y1="320" x2="680" y2="320"/><line x1="0" y1="360" x2="680" y2="360"/><line x1="0" y1="400" x2="680" y2="400"/><line x1="0" y1="440" x2="680" y2="440"/>
      <line x1="40" y1="0" x2="40" y2="500"/><line x1="80" y1="0" x2="80" y2="500"/><line x1="120" y1="0" x2="120" y2="500"/><line x1="160" y1="0" x2="160" y2="500"/><line x1="200" y1="0" x2="200" y2="500"/><line x1="240" y1="0" x2="240" y2="500"/><line x1="280" y1="0" x2="280" y2="500"/><line x1="320" y1="0" x2="320" y2="500"/><line x1="360" y1="0" x2="360" y2="500"/><line x1="400" y1="0" x2="400" y2="500"/><line x1="440" y1="0" x2="440" y2="500"/><line x1="480" y1="0" x2="480" y2="500"/><line x1="520" y1="0" x2="520" y2="500"/><line x1="560" y1="0" x2="560" y2="500"/><line x1="600" y1="0" x2="600" y2="500"/><line x1="640" y1="0" x2="640" y2="500"/>
    </g>
    <g font-family="Georgia, serif" fill="none" opacity="0.55">
      <text x="30" y="270" font-size="90" stroke="#3a4a68" stroke-width="1.5">x</text>
      <text x="120" y="230" font-size="70" stroke="#3a4a68" stroke-width="1.5">Y</text>
      <text x="200" y="200" font-size="60" stroke="#3a4a68" stroke-width="1.5">a</text>
      <text x="80" y="330" font-size="60" stroke="#3a4a68" stroke-width="1.5">Z</text>
      <text x="170" y="360" font-size="50" stroke="#3a4a68" stroke-width="1.5">4</text>
      <text x="240" y="330" font-size="46" stroke="#3a4a68" stroke-width="1.5">b</text>
    </g>
    <g fill="none" stroke="#5b8fd6" stroke-width="1" opacity="0.6">
      <polygon points="330,120 370,150 330,180 290,150"/>
      <polygon points="300,170 335,195 300,220 265,195"/>
      <polygon points="370,150 400,140 400,175 370,190"/>
    </g>
    <g fill="#dfe7f2" opacity="0.75">
      <polygon points="440,150 470,175 440,200"/>
      <polygon points="430,215 460,240 430,265"/>
      <polygon points="450,270 480,295 450,320"/>
    </g>
    <g transform="translate(500,220)">
      <g fill="none" stroke="#3fa9a3" stroke-width="2">
        <circle cx="0" cy="0" r="42"/><circle cx="0" cy="0" r="15"/>
        <line x1="0" y1="-42" x2="0" y2="-54"/><line x1="21" y1="-36" x2="27" y2="-46"/><line x1="36" y1="-21" x2="46" y2="-27"/><line x1="42" y1="0" x2="54" y2="0"/><line x1="36" y1="21" x2="46" y2="27"/><line x1="21" y1="36" x2="27" y2="46"/><line x1="0" y1="42" x2="0" y2="54"/><line x1="-21" y1="36" x2="-27" y2="46"/><line x1="-36" y1="21" x2="-46" y2="27"/><line x1="-42" y1="0" x2="-54" y2="0"/><line x1="-36" y1="-21" x2="-46" y2="-27"/><line x1="-21" y1="-36" x2="-27" y2="-46"/>
      </g>
    </g>
    <g transform="translate(590,175)">
      <g fill="none" stroke="#5b8fd6" stroke-width="2">
        <circle cx="0" cy="0" r="34"/><circle cx="0" cy="0" r="12"/>
        <line x1="0" y1="-34" x2="0" y2="-44"/><line x1="17" y1="-29" x2="22" y2="-37"/><line x1="29" y1="-17" x2="37" y2="-22"/><line x1="34" y1="0" x2="44" y2="0"/><line x1="29" y1="17" x2="37" y2="22"/><line x1="17" y1="29" x2="22" y2="37"/><line x1="0" y1="34" x2="0" y2="44"/><line x1="-17" y1="29" x2="-22" y2="37"/><line x1="-29" y1="17" x2="-37" y2="22"/><line x1="-34" y1="0" x2="-44" y2="0"/><line x1="-29" y1="-17" x2="-37" y2="-22"/><line x1="-17" y1="-29" x2="-22" y2="-37"/>
      </g>
    </g>
    <g transform="translate(475,290)">
      <g fill="none" stroke="#dfe7f2" stroke-width="2.5">
        <circle cx="0" cy="0" r="58"/><circle cx="0" cy="0" r="20"/>
        <line x1="0" y1="-58" x2="0" y2="-74"/><line x1="29" y1="-50" x2="37" y2="-63"/><line x1="50" y1="-29" x2="63" y2="-37"/><line x1="58" y1="0" x2="74" y2="0"/><line x1="50" y1="29" x2="63" y2="37"/><line x1="29" y1="50" x2="37" y2="63"/><line x1="0" y1="58" x2="0" y2="74"/><line x1="-29" y1="50" x2="-37" y2="63"/><line x1="-50" y1="29" x2="-63" y2="37"/><line x1="-58" y1="0" x2="-74" y2="0"/><line x1="-50" y1="-29" x2="-63" y2="-37"/><line x1="-29" y1="-50" x2="-37" y2="-63"/>
      </g>
    </g>
    <g transform="translate(575,300)">
      <g fill="none" stroke="#3fa9a3" stroke-width="2">
        <circle cx="0" cy="0" r="30"/><circle cx="0" cy="0" r="10"/>
        <line x1="0" y1="-30" x2="0" y2="-39"/><line x1="15" y1="-26" x2="19" y2="-33"/><line x1="26" y1="-15" x2="33" y2="-19"/><line x1="30" y1="0" x2="39" y2="0"/><line x1="26" y1="15" x2="33" y2="19"/><line x1="15" y1="26" x2="19" y2="33"/><line x1="0" y1="30" x2="0" y2="39"/><line x1="-15" y1="26" x2="-19" y2="33"/><line x1="-26" y1="15" x2="-33" y2="19"/><line x1="-30" y1="0" x2="-39" y2="0"/><line x1="-26" y1="-15" x2="-33" y2="-19"/><line x1="-15" y1="-26" x2="-19" y2="-33"/>
      </g>
    </g>
  </svg>`;
}

// mistakes helper used by landing quick-stats (defined fully in view_mistakes.js)
function openMistakes(){
  return computeMistakes({}); // no filters
}
