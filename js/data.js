/* ============================================================
   BIG BOOK PACER — data layer
   Loads library/master.json + library/answers.json, builds all
   lookup indices, and tags every question with a type used
   throughout the app (SC/RC/QC/PS/DI/CR).
   ============================================================ */
const DATA = {
  master: null,       // raw array from master.json
  answers: null,       // raw object from answers.json
  tags: null,          // raw object from tags.json (RC/CR sub-type, auto-tagged)
  sections: new Map(), // "test-sid" -> section
  questions: new Map(),// "test-sid-q" -> qrecord
  testIndex: new Map(),// test -> { V:[sec,sec], Q:[...], C:[...] }
  ready: false,
};

function qKey(test, sid, q){ return `${test}-${sid}-${q}`; }
function sKey(test, sid){ return `${test}-${sid}`; }

async function loadData(){
  const bust = Date.now();
  const [master, answers, tags] = await Promise.all([
    fetch(`library/master.json?v=${bust}`, {cache:'no-store'}).then(r=>{ if(!r.ok) throw new Error('master.json '+r.status); return r.json(); }),
    fetch(`library/answers.json?v=${bust}`, {cache:'no-store'}).then(r=>{ if(!r.ok) throw new Error('answers.json '+r.status); return r.json(); }),
    // tags.json is optional — auto-tagging may not have run yet, so a missing/empty file is not an error
    fetch(`library/tags.json?v=${bust}`, {cache:'no-store'}).then(r=> r.ok ? r.json() : {}).catch(()=>({})),
  ]);
  DATA.master = master;
  DATA.answers = answers;
  DATA.tags = tags;
  index();
  applyOverridesToData();
  DATA.ready = true;
}

// Returns the effective RC/CR sub-type for a question: a manual note-tag
// wins if it matches a known label in the taxonomy; otherwise falls back
// to the auto-tag from tags.json. Returns null if untagged either way.
const RC_SUBTYPES = ['inference','main-idea','detail','vocab-in-context','tone','structure'];
const CR_SUBTYPES = ['weaken','strengthen','assumption','inference','paradox','evaluate','bold-face','parallel'];

function effectiveSubType(qkey){
  const auto = DATA.tags && DATA.tags[qkey];
  const taxonomy = auto ? (auto.type === 'rc' ? RC_SUBTYPES : CR_SUBTYPES) : null;
  if(typeof getNote === 'function'){
    const note = getNote(qkey);
    if(note && note.tags && note.tags.length){
      const manual = note.tags.find(t => (taxonomy||RC_SUBTYPES.concat(CR_SUBTYPES)).includes(t.toLowerCase()));
      if(manual) return { subType: manual.toLowerCase(), source: 'manual' };
    }
  }
  if(auto) return { subType: auto.subType, source: 'auto', confidence: auto.confidence, passageLength: auto.passageLength };
  return null;
}

// tutor-entered corrections (from the Answer Key editor) always win over the shipped answers.json
function applyOverridesToData(){
  if(typeof getOverrides !== 'function') return; // state.js not loaded yet
  const overrides = getOverrides();
  for(const [key, ov] of Object.entries(overrides)){
    const q = DATA.questions.get(key);
    if(!q) continue;
    q.answer = ov.a;
    if(ov.p != null) q.pplus = ov.p;
    q.overridden = true;
  }
}

function trackOf(sid){ return sid[0]; } // 'V' | 'Q' | 'C'

function index(){
  DATA.sections.clear();
  DATA.questions.clear();
  DATA.testIndex.clear();

  for(const sec of DATA.master){
    const skey = sKey(sec.test, sec.sid);
    DATA.sections.set(skey, sec);

    if(!DATA.testIndex.has(sec.test)) DATA.testIndex.set(sec.test, {V:[],Q:[],C:[]});
    DATA.testIndex.get(sec.test)[trackOf(sec.sid)].push(sec);

    // DI ranges (graph contexts) for quant sections
    const diRanges = (sec.contexts||[]).filter(c=>c.type==='graph' && c.qfrom!=null)
      .map(c=>[c.qfrom, c.qto]);
    const inDi = (q)=> diRanges.some(([a,b])=> q>=a && q<=b);

    const ansForSec = (DATA.answers[String(sec.test)] || {})[sec.sid] || {};

    for(const qo of sec.questions){
      const key = qKey(sec.test, sec.sid, qo.q);
      const av = ansForSec[String(qo.q)] || null;
      let type = null;
      if(sec.kind === 'verbal'){
        type = qo.q <= 7 ? 'SC' : 'RC';
      } else if(sec.kind === 'quant'){
        type = qo.q <= 15 ? 'QC' : 'PS';
      } else if(sec.kind === 'cr'){
        type = 'CR';
      }
      const isDI = sec.kind === 'quant' && inDi(qo.q);

      // find context images relevant to this question (ctxmap keyed by q number as string)
      const ctxImgs = (sec.ctxmap && sec.ctxmap[String(qo.q)]) || [];
      // full context objects for those imgs
      const ctxObjs = (sec.contexts||[]).filter(c => ctxImgs.includes(c.img));

      DATA.questions.set(key, {
        key, test: sec.test, sid: sec.sid, kind: sec.kind, q: qo.q,
        img: `t${String(sec.test).padStart(2,'0')}/${sec.sid}/${qo.img}`,
        type, isDI,
        answer: av ? av.a : null,
        pplus: av ? av.p : null,
        contexts: ctxObjs.map(c => ({...c, path:`t${String(sec.test).padStart(2,'0')}/${sec.sid}/${c.img}`})),
      });
    }
  }
}

function getSection(test, sid){ return DATA.sections.get(sKey(test,sid)); }
function getQuestion(test, sid, q){ return DATA.questions.get(qKey(test,sid,q)); }

function sectionQuestionKeys(sec){
  return sec.questions.map(qo => qKey(sec.test, sec.sid, qo.q));
}

// pretty label helpers
const TRACK_LABEL = { V:'Verbal Reasoning', Q:'Quantitative Reasoning', C:'Critical Reasoning' };
const TRACK_SHORT  = { V:'Verbal', Q:'Quant', C:'Critical Reasoning' };
const KIND_OF_TRACK = { V:'verbal', Q:'quant', C:'cr' };

function allTests(){
  return [...DATA.testIndex.keys()].sort((a,b)=>a-b);
}

function sectionsForTrack(track){
  // returns flat list of sections for a track sorted by test then sid
  const out = [];
  for(const t of allTests()){
    for(const sec of DATA.testIndex.get(t)[track]) out.push(sec);
  }
  return out.sort((a,b)=> a.test-b.test || a.sid.localeCompare(b.sid));
}

function allSections(){ return DATA.master; }
