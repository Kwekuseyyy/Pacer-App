/* ============================================================
   BIG BOOK PACER — persistence layer (all state in localStorage)
   ============================================================ */
const LS = {
  profile:   'bbp_profile',      // {name, createdAt}
  history:   'bbp_history',      // array of finished session records
  notes:     'bbp_notes',        // { qkey: {text, tags:[], updatedAt} }
  inprogress:'bbp_inprogress',   // single unfinished session record | null
  lastExport:'bbp_last_export',  // ISO timestamp
  dismissedReminder: 'bbp_reminder_dismissed_at',
  overrides: 'bbp_answer_overrides', // { "test-sid-q": {a, p, updatedAt} } — tutor-entered answer key corrections
};

function lsGet(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  }catch(e){ console.error('lsGet failed', key, e); return fallback; }
}
function lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }
  catch(e){ console.error('lsSet failed', key, e); }
}

// ---------- profile ----------
function getProfile(){ return lsGet(LS.profile, null); }
function setProfile(name){ lsSet(LS.profile, {name, createdAt:new Date().toISOString()}); }

// ---------- history ----------
function getHistory(){ return lsGet(LS.history, []); }
function pushHistory(record){
  const h = getHistory();
  h.push(record);
  lsSet(LS.history, h);
}
function historyForSection(test, sid){
  return getHistory().filter(r => r.mode==='section' && r.test===test && r.sid===sid);
}
function historyForTest(test){
  return getHistory().filter(r => r.test===test);
}

// ---------- notes ----------
function getNotes(){ return lsGet(LS.notes, {}); }
function getNote(qkey){ return getNotes()[qkey] || null; }
function setNote(qkey, text, tags){
  const notes = getNotes();
  if(!text && (!tags || !tags.length)){ delete notes[qkey]; }
  else notes[qkey] = { text: text||'', tags: tags||[], updatedAt: new Date().toISOString() };
  lsSet(LS.notes, notes);
}

// ---------- in-progress (resume) ----------
function getInProgress(){ return lsGet(LS.inprogress, null); }
function setInProgress(record){ lsSet(LS.inprogress, record); }
function clearInProgress(){ localStorage.removeItem(LS.inprogress); }

// ---------- export reminder ----------
function getLastExport(){ return lsGet(LS.lastExport, null); }
function markExported(){ lsSet(LS.lastExport, new Date().toISOString()); lsSet(LS.dismissedReminder, new Date().toISOString()); }
function dismissReminder(){ lsSet(LS.dismissedReminder, new Date().toISOString()); }
function shouldShowExportReminder(){
  const last = getLastExport() || getProfile()?.createdAt;
  const dismissed = lsGet(LS.dismissedReminder, null);
  if(!last) return false;
  const days = (Date.now() - new Date(last).getTime()) / 86400000;
  if(days < 3) return false;
  if(dismissed){
    const dDays = (Date.now() - new Date(dismissed).getTime()) / 86400000;
    if(dDays < 3) return false;
  }
  return getHistory().length > 0;
}

// ---------- answer key overrides (tutor edits) ----------
function getOverrides(){ return lsGet(LS.overrides, {}); }
function getOverride(qkey){ return getOverrides()[qkey] || null; }
function setOverride(qkey, a, p){
  const overrides = getOverrides();
  if(a == null){ delete overrides[qkey]; }
  else overrides[qkey] = { a, p: (p==null || p==='') ? null : +p, updatedAt: new Date().toISOString(), pushedAt: null };
  lsSet(LS.overrides, overrides);
  applyOverridesToData(); // take effect immediately, no reload needed
}
function pendingOverrides(){
  const overrides = getOverrides();
  return Object.entries(overrides).filter(([k,ov]) => !ov.pushedAt || new Date(ov.updatedAt) > new Date(ov.pushedAt));
}
function markOverridesPushed(keys){
  const overrides = getOverrides();
  const now = new Date().toISOString();
  for(const k of keys){ if(overrides[k]) overrides[k].pushedAt = now; }
  lsSet(LS.overrides, overrides);
}
function exportOverrides(){
  const overrides = getOverrides();
  const payload = { app:'big-book-pacer-key-patch', version:1, exportedAt:new Date().toISOString(), overrides };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bigbookpacer_key_patch_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------- export / import ----------
function exportAll(){
  const payload = {
    app:'big-book-pacer', version:1, exportedAt:new Date().toISOString(),
    profile:getProfile(), history:getHistory(), notes:getNotes(), overrides:getOverrides(),
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (getProfile()?.name || 'student').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
  a.href = url; a.download = `bigbookpacer_${name}_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  markExported();
}

function importAll(json, mode){ // mode: 'merge' | 'replace'
  if(json.app !== 'big-book-pacer') throw new Error('Not a Big Book Pacer export file.');
  if(mode === 'replace'){
    if(json.profile) lsSet(LS.profile, json.profile);
    lsSet(LS.history, json.history || []);
    lsSet(LS.notes, json.notes || {});
    if(json.overrides) lsSet(LS.overrides, json.overrides);
  } else {
    const h = getHistory();
    const existingIds = new Set(h.map(r=>r.id));
    for(const r of (json.history||[])) if(!existingIds.has(r.id)) h.push(r);
    lsSet(LS.history, h);
    const n = getNotes();
    Object.assign(n, json.notes||{});
    lsSet(LS.notes, n);
    if(json.overrides){
      const o = getOverrides();
      Object.assign(o, json.overrides);
      lsSet(LS.overrides, o);
    }
    if(!getProfile() && json.profile) lsSet(LS.profile, json.profile);
  }
  applyOverridesToData();
}

// import a standalone key-patch file (from exportOverrides, e.g. sent back from Claude)
function importKeyPatch(json){
  if(json.app !== 'big-book-pacer-key-patch') throw new Error('Not a Big Book Pacer key patch file.');
  const o = getOverrides();
  Object.assign(o, json.overrides || {});
  lsSet(LS.overrides, o);
  applyOverridesToData();
}

function wipeAll(){
  Object.values(LS).forEach(k => localStorage.removeItem(k));
}
