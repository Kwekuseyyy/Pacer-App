/* ============================================================
   PLAYER — kiosk-style question runner
   ============================================================ */
let PLAYER = null; // { session, mount, timerHandle, enteredAt, paletteOpen, timerVisible, locked }

function viewPlayer(mount, session){
  PLAYER = {
    session, mount,
    timerHandle: null,
    enteredAt: Date.now(),
    paletteOpen: false,
    timerVisible: true,
    locked: false,
  };
  mount.classList.add('player-mount');
  renderPlayerShell();
  renderQuestion();
  startTicker();
  document.addEventListener('keydown', onPlayerKey);
  const cleanup = ()=> document.removeEventListener('keydown', onPlayerKey);
  const origGo = go;
  // stop ticker whenever we navigate away (handled in navigatePlayer/finish)
}

function stopPlayer(){
  if(PLAYER?.timerHandle) clearInterval(PLAYER.timerHandle);
  document.removeEventListener('keydown', onPlayerKey);
  PLAYER = null;
}

function currentQ(){
  const {session} = PLAYER;
  return getQuestion(...session.qkeys[session.cursor].split('-').map((v,i)=> i===0? +v : (i===2? +v : v)));
}
// qkey split helper is fragile with sid like "V1" (has a letter) — use direct lookup instead:
function qFromKey(key){ return DATA.questions.get(key); }

function timeRemaining(){
  const {session} = PLAYER;
  if(!session.timed) return null;
  const usedSoFar = session.elapsedSec + (Date.now() - PLAYER.enteredAt)/1000;
  return Math.max(0, session.allottedSec - usedSoFar);
}

function renderPlayerShell(){
  const {session} = PLAYER;
  const sec = session.mode==='section' ? getSection(session.test, session.sid) : null;
  PLAYER.mount.innerHTML = `
    <div class="player">
      <div class="player-topbar">
        <div class="pt-left">
          <button class="btn btn-sm btn-ghost" id="exitBtn">Exit</button>
          ${sec && sec.kind==='quant' ? `<span class="pill nocalc">No calculator</span>` : ''}
        </div>
        <div class="pt-center">
          <span class="player-label">${esc(session.label)}</span>
        </div>
        <div class="pt-right">
          ${session.timed ? `
            <button class="btn btn-sm btn-ghost" id="timerToggle" title="Show/hide timer">${PLAYER.timerVisible?'Hide':'Show'} timer</button>
            <span class="timer-pill mono ${PLAYER.timerVisible?'':'vis-hidden'}" id="timerPill">--:--</span>
          ` : `<span class="pill" style="background:var(--cardline);color:var(--mut);">Untimed</span>`}
          <button class="btn btn-sm btn-ghost" id="fsToggle" title="Fullscreen">&#x26F6;</button>
        </div>
      </div>

      <div class="player-body" id="playerBody"></div>

      <div class="player-footer">
        <div class="pf-left">
          <button class="btn btn-flag" id="markBtn">&#9873; Mark for Review</button>
        </div>
        <div class="pf-center">
          <button class="btn" id="paletteBtn">Question <span id="qPos"></span> &middot; Palette</button>
        </div>
        <div class="pf-right">
          <button class="btn" id="prevBtn">&larr; Back</button>
          <button class="btn btn-primary" id="nextBtn">Next &rarr;</button>
          <button class="btn btn-gold" id="finishBtn" style="display:none;">Finish Section</button>
        </div>
      </div>

      <div class="palette-drawer" id="paletteDrawer" hidden></div>
    </div>`;

  document.getElementById('exitBtn').addEventListener('click', exitPlayer);
  document.getElementById('fsToggle').addEventListener('click', toggleFullscreen);
  document.getElementById('markBtn').addEventListener('click', toggleMark);
  document.getElementById('paletteBtn').addEventListener('click', togglePalette);
  document.getElementById('prevBtn').addEventListener('click', ()=> navigatePlayer(-1));
  document.getElementById('nextBtn').addEventListener('click', ()=> navigatePlayer(1));
  document.getElementById('finishBtn').addEventListener('click', confirmFinish);
  if(session.timed) document.getElementById('timerToggle').addEventListener('click', ()=>{
    PLAYER.timerVisible = !PLAYER.timerVisible;
    document.getElementById('timerPill').classList.toggle('vis-hidden', !PLAYER.timerVisible);
    document.getElementById('timerToggle').textContent = (PLAYER.timerVisible?'Hide':'Show') + ' timer';
  });
}

function startTicker(){
  updateTimerDisplay();
  PLAYER.timerHandle = setInterval(()=>{
    updateTimerDisplay();
    const rem = timeRemaining();
    if(PLAYER.session.timed && rem !== null && rem <= 0 && !PLAYER.locked){
      onTimeUp();
    }
  }, 250);
}

function updateTimerDisplay(){
  if(!PLAYER.session.timed) return;
  const el = document.getElementById('timerPill');
  if(!el) return;
  const rem = timeRemaining();
  el.textContent = fmtTime(rem);
  el.classList.toggle('timer-danger', rem <= 60);
}

function onTimeUp(){
  PLAYER.locked = true;
  clearInterval(PLAYER.timerHandle);
  commitTimeForCurrent();
  toast("Time's up — section locked and submitted.");
  setTimeout(()=> finishSession(), 900);
}

function commitTimeForCurrent(){
  const {session} = PLAYER;
  const key = session.qkeys[session.cursor];
  const elapsedMs = Date.now() - PLAYER.enteredAt;
  const rec = session.answers[key] || (session.answers[key] = {picked:null, eliminated:[], marked:false, timeMs:0});
  rec.timeMs += elapsedMs;
  session.elapsedSec += elapsedMs/1000;
  PLAYER.enteredAt = Date.now();
}

function renderQuestion(){
  const {session} = PLAYER;
  const key = session.qkeys[session.cursor];
  const q = qFromKey(key);
  const rec = session.answers[key] || (session.answers[key] = {picked:null, eliminated:[], marked:false, timeMs:0});
  const body = document.getElementById('playerBody');

  const isQC = q.type === 'QC';
  const letters = isQC ? ['A','B','C','D'] : ['A','B','C','D','E'];
  const qcLabels = { A:'Quantity A is greater', B:'Quantity B is greater', C:'The two quantities are equal', D:'The relationship cannot be determined from the information given' };

  const passageCtxs = q.contexts.filter(c=>c.type==='passage');
  const stackedCtxs = q.contexts.filter(c=>c.type!=='passage');
  const hasPassage = passageCtxs.length>0;

  const note = getNote(key);

  const questionPane = `
    <div class="q-pane">
      ${stackedCtxs.length ? `<div class="ctx-stack">${stackedCtxs.map(c=>`<img src="${c.path}" alt="${c.type} for question ${q.q}" loading="lazy"/>`).join('')}</div>` : ''}
      <div class="q-card card">
        <div class="q-card-head">
          <span class="q-num mono">Q${q.q}</span>
          ${isQC ? `<span class="pill qc-pill">QUANTITATIVE COMPARISON</span>` : ''}
          ${q.isDI ? `<span class="pill" style="background:var(--goldsoft); color:var(--ink);">DATA INTERPRETATION</span>` : ''}
          <button class="note-btn" id="noteBtn" title="Tutor note">&#128221;${note ? ' &middot;' : ''}</button>
        </div>
        <img class="q-img" src="${q.img}" alt="Question ${q.q}" />
        <div class="choices" id="choices">
          ${letters.map(L => `
            <button class="choice ${rec.picked===L?'choice-picked':''} ${rec.eliminated.includes(L)?'choice-eliminated':''}" data-letter="${L}">
              <span class="choice-letter">${L}</span>
              ${isQC ? `<span class="choice-text">${qcLabels[L]}</span>` : ''}
            </button>`).join('')}
        </div>
      </div>
    </div>`;

  if(hasPassage){
    body.className = 'player-body split';
    body.innerHTML = `
      <div class="passage-pane">
        ${passageCtxs.map(c=>`<img src="${c.path}" alt="Passage" loading="lazy"/>`).join('<div class="passage-divider"></div>')}
      </div>
      ${questionPane}`;
  } else {
    body.className = 'player-body single';
    body.innerHTML = questionPane;
  }

  body.querySelectorAll('.choice').forEach(btn=>{
    btn.addEventListener('click', ()=> pickLetter(btn.getAttribute('data-letter')));
  });
  document.getElementById('noteBtn').addEventListener('click', ()=> openNoteEditor(key));

  document.getElementById('markBtn').classList.toggle('active', !!rec.marked);
  document.getElementById('qPos').textContent = `${session.cursor+1} / ${session.qkeys.length}`;
  document.getElementById('prevBtn').disabled = session.cursor===0;
  const isLast = session.cursor === session.qkeys.length-1;
  document.getElementById('nextBtn').style.display = isLast ? 'none' : '';
  document.getElementById('finishBtn').style.display = isLast ? '' : 'none';

  if(PLAYER.paletteOpen) renderPalette();
  persistSession();
}

function pickLetter(L){
  if(PLAYER.locked) return;
  const {session} = PLAYER;
  const key = session.qkeys[session.cursor];
  const rec = session.answers[key];
  if(rec.eliminated.includes(L)){
    rec.eliminated = rec.eliminated.filter(x=>x!==L); // restore
  } else if(rec.picked === L){
    rec.picked = null;
    rec.eliminated = [...new Set([...rec.eliminated, L])];
  } else {
    rec.picked = L;
  }
  renderQuestion();
}

function onPlayerKey(e){
  if(!PLAYER || PLAYER.locked) return;
  const tag = document.activeElement?.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key.toUpperCase();
  if(['A','B','C','D','E'].includes(k)){
    const btn = document.querySelector(`.choice[data-letter="${k}"]`);
    if(btn) pickLetter(k);
  } else if(e.key === 'ArrowRight'){ navigatePlayer(1); }
  else if(e.key === 'ArrowLeft'){ navigatePlayer(-1); }
  else if(k === 'M'){ toggleMark(); }
}

function navigatePlayer(dir){
  const {session} = PLAYER;
  const next = session.cursor + dir;
  if(next < 0 || next >= session.qkeys.length) return;
  commitTimeForCurrent();
  session.cursor = next;
  PLAYER.paletteOpen = false;
  document.getElementById('paletteDrawer').hidden = true;
  renderQuestion();
}

function jumpTo(idx){
  if(idx === PLAYER.session.cursor) { PLAYER.paletteOpen=false; document.getElementById('paletteDrawer').hidden=true; return; }
  commitTimeForCurrent();
  PLAYER.session.cursor = idx;
  PLAYER.paletteOpen = false;
  document.getElementById('paletteDrawer').hidden = true;
  renderQuestion();
}

function toggleMark(){
  const {session} = PLAYER;
  const key = session.qkeys[session.cursor];
  const rec = session.answers[key];
  rec.marked = !rec.marked;
  document.getElementById('markBtn').classList.toggle('active', rec.marked);
  if(PLAYER.paletteOpen) renderPalette();
  persistSession();
}

function togglePalette(){
  PLAYER.paletteOpen = !PLAYER.paletteOpen;
  const drawer = document.getElementById('paletteDrawer');
  drawer.hidden = !PLAYER.paletteOpen;
  if(PLAYER.paletteOpen) renderPalette();
}

function renderPalette(){
  const {session} = PLAYER;
  const drawer = document.getElementById('paletteDrawer');
  drawer.innerHTML = `
    <div class="palette-inner">
      <div class="palette-legend">
        <span><i class="dot dot-answered"></i>Answered</span>
        <span><i class="dot dot-current"></i>Current</span>
        <span><i class="dot dot-marked"></i>Marked</span>
        <span><i class="dot dot-empty"></i>Unanswered</span>
      </div>
      <div class="palette-grid">
        ${session.qkeys.map((key,i)=>{
          const rec = session.answers[key];
          const q = qFromKey(key);
          const cls = [
            i===session.cursor ? 'pg-current':'',
            rec?.picked ? 'pg-answered':'',
            rec?.marked ? 'pg-marked':'',
          ].filter(Boolean).join(' ');
          return `<button class="pg-cell ${cls}" data-idx="${i}">${q.q}</button>`;
        }).join('')}
      </div>
    </div>`;
  drawer.querySelectorAll('.pg-cell').forEach(btn=>{
    btn.addEventListener('click', ()=> jumpTo(+btn.getAttribute('data-idx')));
  });
}

function toggleFullscreen(){
  try{
    if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }catch(e){ /* fullscreen not available — ignore silently */ }
}

function exitPlayer(){
  if(!confirm('Exit this section? Your progress is saved and you can resume from the home screen.')) return;
  commitTimeForCurrent();
  persistSession();
  stopPlayer();
  ROUTE_STACK.length = 0;
  go({view:'landing'});
}

function confirmFinish(){
  const {session} = PLAYER;
  const unanswered = session.qkeys.filter(k => !session.answers[k]?.picked).length;
  if(unanswered > 0){
    if(!confirm(`${unanswered} question${unanswered>1?'s':''} still unanswered. Finish anyway?`)) return;
  }
  finishSession();
}

function finishSession(){
  commitTimeForCurrent();
  const {session} = PLAYER;
  session.finishedAt = new Date().toISOString();
  const score = scoreSession(session);
  session.score = score;
  pushHistory(session);
  clearInProgress();
  stopPlayer();
  ROUTE_STACK.length = 0;
  go({view:'review', record: session}, {replace:true});
}

function scoreSession(session){
  let correct=0, scorable=0, unscored=0;
  for(const key of session.qkeys){
    const q = qFromKey(key);
    const rec = session.answers[key];
    if(q.answer == null){ unscored++; continue; }
    scorable++;
    if(rec?.picked === q.answer) correct++;
  }
  return {correct, scorable, unscored, total: session.qkeys.length};
}

function persistSession(){
  if(PLAYER?.session && !PLAYER.session.finishedAt) setInProgress(PLAYER.session);
}

function toast(msg){
  const t = document.createElement('div');
  t.className = 'bbp-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.add('show'), 10);
  setTimeout(()=> { t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 2600);
}

// ---------- note editor (mini modal) ----------
function openNoteEditor(qkey){
  const existing = getNote(qkey);
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `
    <div class="modal">
      <h3 style="margin:0 0 10px;">Tutor note</h3>
      <textarea id="noteText" rows="5" style="width:100%; padding:10px; border:1px solid var(--cardline); border-radius:10px; font-family:inherit; font-size:14.5px;">${esc(existing?.text||'')}</textarea>
      <label class="field-label" style="margin-top:12px;">Tags (comma separated — e.g. "ratio trap, careless")</label>
      <input id="noteTags" type="text" value="${esc((existing?.tags||[]).join(', '))}" style="width:100%; padding:9px 12px; border:1px solid var(--cardline); border-radius:10px;"/>
      <div style="display:flex; justify-content:space-between; margin-top:16px;">
        <button class="btn btn-ghost" id="noteCancel">Cancel</button>
        <button class="btn btn-primary" id="noteSave">Save note</button>
      </div>
    </div>`;
  document.body.appendChild(scrim);
  scrim.querySelector('#noteCancel').addEventListener('click', ()=> scrim.remove());
  scrim.querySelector('#noteSave').addEventListener('click', ()=>{
    const text = scrim.querySelector('#noteText').value.trim();
    const tags = scrim.querySelector('#noteTags').value.split(',').map(s=>s.trim()).filter(Boolean);
    setNote(qkey, text, tags);
    scrim.remove();
    if(PLAYER) renderQuestion();
  });
}
