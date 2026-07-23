/* ============================================================
   BIG BOOK PACER — router + bootstrap
   ============================================================ */
const APP = document.getElementById('app');
const VIEW = document.getElementById('view');

let ROUTE = { view:'landing' };
const ROUTE_STACK = [];

function go(route, {replace}={}){
  if(!replace) ROUTE_STACK.push(ROUTE);
  ROUTE = route;
  render();
  window.scrollTo(0,0);
}
function back(fallback){
  const prev = ROUTE_STACK.pop();
  ROUTE = prev || fallback || {view:'landing'};
  render();
  window.scrollTo(0,0);
}

function uid(){ return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtTime(sec){
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec/60), s = sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'});
}

function renderHeader(){
  const profile = getProfile();
  return `
  <header class="dark-header">
    <div class="container bbp-headbar">
      <button class="bbp-brand" data-nav="landing" aria-label="Big Book Pacer home">
        <span class="bb-mark">BB</span>
        <span class="brand-word">Big&nbsp;Book&nbsp;Pacer</span>
      </button>
      <nav class="bbp-nav">
        <button class="navlink" data-nav="mistakes">Mistakes</button>
        <button class="navlink" data-nav="custom">Custom Set</button>
        <button class="navlink" data-nav="analytics">Analytics</button>
        <button class="navlink" data-nav="notes">Notes</button>
        <button class="navlink" id="tutorToolsBtn" title="Answer key editor">Tutor Tools</button>
        ${profile ? `<span class="who">${esc(profile.name)}</span>` : ''}
      </nav>
    </div>
  </header>`;
}

function render(){
  VIEW.innerHTML = renderHeader() + '<main class="bbp-main" id="mainview"></main>';
  wireHeader();
  const mount = document.getElementById('mainview');

  switch(ROUTE.view){
    case 'landing': return viewLanding(mount);
    case 'tests': return viewTests(mount, ROUTE.track);
    case 'sectionSelect': return viewSectionSelect(mount, ROUTE.track, ROUTE.test);
    case 'pretest': return viewPretest(mount, ROUTE.test, ROUTE.sid);
    case 'player': return viewPlayer(mount, ROUTE.session);
    case 'review': return viewReview(mount, ROUTE.record);
    case 'mistakes': return viewMistakes(mount);
    case 'custom': return viewCustom(mount);
    case 'analytics': return viewAnalytics(mount);
    case 'notes': return viewNotes(mount);
    case 'keyeditor': return viewKeyEditor(mount);
    default: return viewLanding(mount);
  }
}

function wireHeader(){
  VIEW.querySelectorAll('[data-nav]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const v = btn.getAttribute('data-nav');
      guardNavAway(()=> go({view:v}));
    });
  });
  document.getElementById('tutorToolsBtn')?.addEventListener('click', ()=>{
    guardNavAway(()=> ensureTutorUnlocked(()=> go({view:'keyeditor'})));
  });
}

// ---------- tutor PIN gate (client-side friction only, not real security) ----------
const TUTOR_PIN = '1234';
function ensureTutorUnlocked(cb){
  if(sessionStorage.getItem('bbp_tutor_unlocked') === '1') return cb();
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `
    <div class="modal" style="max-width:340px;">
      <h3 style="margin:0 0 8px;">Tutor Tools</h3>
      <p style="color:var(--mut); font-size:13.5px; margin:0 0 14px;">Enter the tutor PIN to edit the answer key.</p>
      <input id="pinInput" type="password" inputmode="numeric" placeholder="PIN" style="width:100%; padding:11px 14px; border:1px solid var(--cardline); border-radius:10px; font-size:15px; margin-bottom:14px; letter-spacing:.2em;"/>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-ghost" id="pinCancel">Cancel</button>
        <button class="btn btn-primary" id="pinGo">Unlock</button>
      </div>
    </div>`;
  document.body.appendChild(scrim);
  const input = scrim.querySelector('#pinInput');
  input.focus();
  const attempt = ()=>{
    if(input.value === TUTOR_PIN){
      sessionStorage.setItem('bbp_tutor_unlocked','1');
      scrim.remove();
      cb();
    } else {
      input.value = '';
      input.placeholder = 'Wrong PIN — try again';
      input.classList.add('timer-danger');
    }
  };
  scrim.querySelector('#pinGo').addEventListener('click', attempt);
  scrim.querySelector('#pinCancel').addEventListener('click', ()=> scrim.remove());
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') attempt(); });
}

// prevent accidentally abandoning a timed, in-progress player session
function guardNavAway(cb){
  if(ROUTE.view === 'player' && ROUTE.session && !ROUTE.session.finishedAt){
    if(!confirm('Leave this section? Your progress is saved and you can resume later.')) return;
  }
  cb();
}

// ---------- name prompt ----------
function ensureProfile(cb){
  const p = getProfile();
  if(p) return cb();
  showNamePrompt(cb);
}
function showNamePrompt(cb){
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `
    <div class="modal">
      <h2 style="margin:0 0 6px;">Welcome to Big Book Pacer</h2>
      <p style="color:var(--mut); margin:0 0 18px; font-size:14.5px;">What should we call you? This labels your history and exports.</p>
      <input id="nameInput" type="text" placeholder="Your name" style="width:100%; padding:11px 14px; border:1px solid var(--cardline); border-radius:10px; font-size:15px; margin-bottom:16px;" />
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="btn btn-primary" id="nameSave">Start</button>
      </div>
    </div>`;
  document.body.appendChild(scrim);
  const input = scrim.querySelector('#nameInput');
  input.focus();
  const save = ()=>{
    const val = input.value.trim();
    setProfile(val || 'Student');
    scrim.remove();
    cb();
  };
  scrim.querySelector('#nameSave').addEventListener('click', save);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') save(); });
}

// ---------- export reminder banner ----------
function maybeShowExportReminder(mount){
  if(!shouldShowExportReminder()) return;
  const bar = document.createElement('div');
  bar.className = 'reminder-bar';
  bar.innerHTML = `
    <span>It's been a few days since your last export — back up your history so you never lose progress.</span>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-sm btn-gold" id="remExport">Export now</button>
      <button class="btn btn-sm btn-ghost" id="remDismiss">Not now</button>
    </div>`;
  mount.prepend(bar);
  bar.querySelector('#remExport').addEventListener('click', ()=>{ exportAll(); bar.remove(); });
  bar.querySelector('#remDismiss').addEventListener('click', ()=>{ dismissReminder(); bar.remove(); });
}

// ---------- resume banner (in-progress session) ----------
function maybeShowResumeBanner(mount){
  const ip = getInProgress();
  if(!ip || ip.finishedAt) return;
  const sec = ip.mode==='section' ? getSection(ip.test, ip.sid) : null;
  const bar = document.createElement('div');
  bar.className = 'resume-bar';
  bar.innerHTML = `
    <span>You have an unfinished session — <strong>${esc(ip.label)}</strong> (${answeredCount(ip)}/${ip.qkeys.length} answered). Pick up where you left off?</span>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-sm btn-gold" id="resumeGo">Resume</button>
      <button class="btn btn-sm btn-ghost" id="resumeDiscard">Discard</button>
    </div>`;
  mount.prepend(bar);
  bar.querySelector('#resumeGo').addEventListener('click', ()=>{
    go({view:'player', session: ip});
  });
  bar.querySelector('#resumeDiscard').addEventListener('click', ()=>{
    if(confirm('Discard this in-progress session? This cannot be undone.')){
      clearInProgress(); render();
    }
  });
}

function answeredCount(session){
  return session.qkeys.filter(k => session.answers[k] && session.answers[k].picked).length;
}

// ---------- boot ----------
(async function boot(){
  await requireAuth(VIEW, async () => {
    try{
      await loadData();
    }catch(err){
      VIEW.innerHTML = `<div class="container" style="padding:60px 24px;">
        <h2>Couldn't load the library</h2>
        <p style="color:var(--mut)">${esc(err.message)}. Make sure <code>library/master.json</code> and <code>library/answers.json</code> are being served alongside this page (open via a local server, not file://).</p>
      </div>`;
      return;
    }
    ensureProfile(()=> render());
  });
})();
