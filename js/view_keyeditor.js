/* ============================================================
   ANSWER KEY EDITOR — tutor-only. Lets you correct any answer
   key (fill a gap, or fix a book errata) without touching code.
   Saves to localStorage immediately (scoring updates live), and
   pushes to GitHub as a real commit to make it permanent for
   every student, on every device, once configured.
   ============================================================ */
function isOriginallyNull(q){
  const raw = (DATA.answers[String(q.test)] || {})[q.sid] || {};
  const v = raw[String(q.q)];
  return !v || v.a == null;
}

function viewKeyEditor(mount){
  const overrides = getOverrides();
  const overrideCount = Object.keys(overrides).length;
  const allQ = allQuestionsFlat();
  const gapCount = allQ.filter(isOriginallyNull).length;

  mount.innerHTML = `
    <section class="container">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 class="section-title">Answer key editor</h2>
          <p class="section-sub">${gapCount} question${gapCount===1?'':'s'} shipped without a key &middot; ${overrideCount} correction${overrideCount===1?'':'s'} on this device</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn" id="kImportPatch">Import patch</button>
          <input type="file" id="kImportFile" accept="application/json" style="display:none;"/>
          <button class="btn btn-gold" id="kExportPatch" ${overrideCount===0?'disabled':''}>Export patch (${overrideCount})</button>
        </div>
      </div>

      <div id="githubPanel"></div>

      <div class="filter-bar card">
        <div class="filter-field">
          <label>Test</label>
          <select id="kTest"><option value="">Any</option>${allTests().map(t=>`<option value="${t}">Test ${t}</option>`).join('')}</select>
        </div>
        <div class="filter-field">
          <label>Section</label>
          <select id="kTrack"><option value="">Any</option><option value="V">Verbal</option><option value="Q">Quant</option><option value="C">Critical Reasoning</option></select>
        </div>
        <div class="filter-field">
          <label>Question #</label>
          <input type="number" id="kQnum" min="1" max="30" placeholder="Any" style="width:80px;"/>
        </div>
        <label class="check-row" style="align-self:flex-end;"><input type="checkbox" id="kGapsOnly" checked/> Missing key only</label>
      </div>

      <div id="keyResults"></div>
    </section>`;

  document.getElementById('kExportPatch').addEventListener('click', exportOverrides);
  document.getElementById('kImportPatch').addEventListener('click', ()=> document.getElementById('kImportFile').click());
  document.getElementById('kImportFile').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    try{
      const json = JSON.parse(await file.text());
      importKeyPatch(json);
      toast('Patch imported — answers updated.');
      renderKeyEditorAll();
    }catch(err){ alert('Could not import that file: ' + err.message); }
  });

  ['kTest','kTrack','kQnum','kGapsOnly'].forEach(id=>{
    document.getElementById(id).addEventListener('input', renderKeyResults);
  });

  renderGithubPanel();
  renderKeyResults();
}

function renderKeyEditorAll(){
  // full refresh of header counts + github panel + table, preserving filter selections
  refreshKeyEditorHeader();
  renderGithubPanel();
  renderKeyResults();
}

/* ---------------- GitHub sync panel ---------------- */

function renderGithubPanel(){
  const box = document.getElementById('githubPanel');
  const cfg = getGithubConfig();
  const pending = pendingOverrides();

  if(!cfg){
    box.innerHTML = `
      <div class="card github-panel">
        <h3 style="margin:0 0 6px;">Connect GitHub to make corrections permanent</h3>
        <p class="mut" style="margin:0 0 14px; font-size:13.5px;">
          Without this, corrections only apply on this device. Connected, "Push" commits straight to
          <code>library/answers.json</code> in your repo — every student gets it on their next load,
          once GitHub Pages finishes rebuilding (usually under a minute).
        </p>
        <details style="margin-bottom:14px;">
          <summary style="cursor:pointer; font-size:13px; color:var(--gold); font-weight:600;">How to create the token</summary>
          <ol style="font-size:13px; color:var(--mut); margin:10px 0 0; padding-left:20px; line-height:1.7;">
            <li>Go to <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></li>
            <li>Under "Repository access", choose "Only select repositories" and pick this app's repo</li>
            <li>Under "Permissions" &rarr; "Repository permissions" &rarr; set <strong>Contents</strong> to <strong>Read and write</strong></li>
            <li>Set an expiration (90 days is reasonable — you'll just re-paste a new token when it expires)</li>
            <li>Generate, copy the token, paste it below</li>
          </ol>
        </details>
        <div class="github-form">
          <input id="ghOwner" type="text" placeholder="GitHub username or org"/>
          <input id="ghRepo" type="text" placeholder="Repo name"/>
          <input id="ghPath" type="text" placeholder="Path to answers.json" value="library/answers.json"/>
          <input id="ghBranch" type="text" placeholder="Branch (default: main)"/>
          <input id="ghToken" type="password" placeholder="Fine-grained token (github_pat_...)"/>
        </div>
        <button class="btn btn-primary" id="ghSave" style="margin-top:10px;">Connect</button>
        <span id="ghSaveStatus" class="mut" style="margin-left:10px; font-size:13px;"></span>
      </div>`;
    document.getElementById('ghSave').addEventListener('click', async ()=>{
      const owner = document.getElementById('ghOwner').value.trim();
      const repo = document.getElementById('ghRepo').value.trim();
      const path = document.getElementById('ghPath').value.trim() || 'library/answers.json';
      const branch = document.getElementById('ghBranch').value.trim();
      const token = document.getElementById('ghToken').value.trim();
      const statusEl = document.getElementById('ghSaveStatus');
      if(!owner || !repo || !token){ statusEl.textContent = 'Fill in owner, repo, and token.'; return; }
      setGithubConfig({owner, repo, path, branch, token});
      statusEl.textContent = 'Testing connection…';
      try{
        await testGithubConnection();
        toast('Connected to GitHub.');
        renderKeyEditorAll();
      }catch(err){
        statusEl.textContent = 'Connection failed: ' + err.message;
        clearGithubConfig();
      }
    });
    return;
  }

  box.innerHTML = `
    <div class="card github-panel github-connected">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong>Connected</strong> — <span class="mono">${esc(cfg.owner)}/${esc(cfg.repo)}</span>
          <span class="mut"> &middot; ${esc(cfg.path)}${cfg.branch ? ' &middot; '+esc(cfg.branch) : ''}</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm btn-ghost" id="ghDisconnect">Disconnect</button>
          <button class="btn btn-gold" id="ghPush" ${pending.length===0?'disabled':''}>
            Push ${pending.length} pending correction${pending.length===1?'':'s'}
          </button>
        </div>
      </div>
      <div id="ghPushStatus" class="mut" style="margin-top:8px; font-size:13px;"></div>
    </div>`;

  document.getElementById('ghDisconnect').addEventListener('click', ()=>{
    if(confirm('Disconnect GitHub? Local corrections stay saved on this device, but pushing them permanently will need reconnecting.')){
      clearGithubConfig();
      renderKeyEditorAll();
    }
  });
  document.getElementById('ghPush').addEventListener('click', pushPendingCorrections);
}

async function pushPendingCorrections(){
  const pending = pendingOverrides();
  if(!pending.length) return;
  const btn = document.getElementById('ghPush');
  const statusEl = document.getElementById('ghPushStatus');
  btn.disabled = true;
  btn.textContent = 'Pushing…';
  statusEl.textContent = '';
  try{
    const corrections = pending.map(([key, ov])=>{
      const [test, sid, q] = splitQKey(key);
      return { test, sid, q, a: ov.a, p: ov.p };
    });
    const result = await pushCorrectionsToGithub(corrections);
    markOverridesPushed(pending.map(([key])=>key));
    statusEl.innerHTML = `Pushed ${result.pushed} correction${result.pushed===1?'':'s'} as one commit.` +
      (result.commitUrl ? ` <a href="${result.commitUrl}" target="_blank" rel="noopener">View commit</a> — live once Pages rebuilds (usually under a minute).` : '');
    toast('Pushed to GitHub.');
    renderKeyEditorAll();
  }catch(err){
    statusEl.textContent = 'Push failed: ' + err.message;
    btn.disabled = false;
    btn.textContent = `Push ${pending.length} pending correction${pending.length===1?'':'s'}`;
  }
}

// "test-sid-q" -> [test:number, sid:string, q:number] — sid itself never contains
// a literal '-' in this dataset (V1, Q12, C6...), so this split is always safe.
function splitQKey(key){
  const parts = key.split('-');
  const test = +parts[0];
  const q = +parts[parts.length-1];
  const sid = parts.slice(1, -1).join('-');
  return [test, sid, q];
}

/* ---------------- filterable results table ---------------- */

function renderKeyResults(){
  const test = +document.getElementById('kTest').value || null;
  const track = document.getElementById('kTrack').value || null;
  const qnum = +document.getElementById('kQnum').value || null;
  const gapsOnly = document.getElementById('kGapsOnly').checked;

  let list = allQuestionsFlat().filter(q=>{
    if(test && q.test !== test) return false;
    if(track && trackOf(q.sid) !== track) return false;
    if(qnum && q.q !== qnum) return false;
    if(gapsOnly && !isOriginallyNull(q)) return false;
    return true;
  }).sort((a,b)=> a.test-b.test || a.sid.localeCompare(b.sid) || a.q-b.q);

  const capped = list.slice(0, 300);
  const box = document.getElementById('keyResults');
  box.innerHTML = `
    <p class="mut" style="margin:14px 0;">${list.length} question${list.length===1?'':'s'}${list.length>300?' (showing first 300 — narrow the filters)':''}</p>
    <table class="review-table key-table">
      <thead><tr><th>Test</th><th>Sec</th><th>Q</th><th>Book key</th><th>Effective key</th><th>P+</th><th>New answer</th><th>New P+</th><th></th><th></th></tr></thead>
      <tbody>
        ${capped.map(q => keyEditorRow(q)).join('') || `<tr><td colspan="10" class="mut" style="text-align:center; padding:24px;">No questions match these filters.</td></tr>`}
      </tbody>
    </table>`;

  box.querySelectorAll('[data-view-q]').forEach(btn=> btn.addEventListener('click', ()=> openQuestionZoom(btn.getAttribute('data-view-q'))));
  box.querySelectorAll('[data-save-q]').forEach(btn=> btn.addEventListener('click', ()=> saveKeyRow(btn.getAttribute('data-save-q'))));
  box.querySelectorAll('[data-clear-q]').forEach(btn=> btn.addEventListener('click', ()=> clearKeyRow(btn.getAttribute('data-clear-q'))));
}

function keyEditorRow(q){
  const wasNull = isOriginallyNull(q);
  const ov = getOverride(q.key);
  const isPending = ov && (!ov.pushedAt || new Date(ov.updatedAt) > new Date(ov.pushedAt));
  const letters = q.type === 'QC' ? ['A','B','C','D'] : ['A','B','C','D','E'];
  const badge = ov
    ? (isPending
        ? ' <span class="pill" style="background:var(--redsoft); color:var(--red); font-size:10px;">pending push</span>'
        : ' <span class="pill" style="background:var(--greensoft); color:var(--green); font-size:10px;">on GitHub</span>')
    : '';
  return `
    <tr class="${wasNull && !ov ? 'row-nokey' : ov ? 'row-correct' : ''}">
      <td class="mono">T${q.test}</td>
      <td class="mono">${q.sid}</td>
      <td class="mono">${q.q}</td>
      <td class="mono">${wasNull ? '<span class="mut">none</span>' : (DATA.answers[String(q.test)][q.sid][String(q.q)].a)}</td>
      <td class="mono">${q.answer ? `<strong>${q.answer}</strong>${badge}` : '<span class="mut">unavailable</span>'}</td>
      <td class="mono">${q.pplus!=null ? q.pplus+'%' : '—'}</td>
      <td>
        <select id="ans-${q.key}" style="padding:6px 8px; border:1px solid var(--cardline); border-radius:6px;">
          <option value="">—</option>
          ${letters.map(L=>`<option value="${L}" ${ov&&ov.a===L?'selected':''}>${L}</option>`).join('')}
        </select>
      </td>
      <td><input type="number" id="pp-${q.key}" min="0" max="100" placeholder="${q.pplus??''}" value="${ov&&ov.p!=null?ov.p:''}" style="width:56px; padding:6px; border:1px solid var(--cardline); border-radius:6px;"/></td>
      <td><button class="btn btn-sm btn-gold" data-save-q="${q.key}">Save</button></td>
      <td>${ov ? `<button class="btn btn-sm btn-ghost" data-clear-q="${q.key}">Undo</button>` : `<button class="btn btn-sm btn-ghost" data-view-q="${q.key}">View</button>`}</td>
    </tr>`;
}

function saveKeyRow(key){
  const sel = document.getElementById(`ans-${key}`);
  const ppInput = document.getElementById(`pp-${key}`);
  const letter = sel.value;
  if(!letter){ alert('Pick an answer letter first.'); return; }
  setOverride(key, letter, ppInput.value);
  toast(`Saved locally — push to GitHub to make it permanent.`);
  renderKeyEditorAll();
}

function clearKeyRow(key){
  setOverride(key, null);
  renderKeyEditorAll();
}

function refreshKeyEditorHeader(){
  const overrideCount = Object.keys(getOverrides()).length;
  const gapCount = allQuestionsFlat().filter(isOriginallyNull).length;
  const sub = document.querySelector('#mainview .section-sub');
  if(sub) sub.textContent = `${gapCount} question${gapCount===1?'':'s'} shipped without a key · ${overrideCount} correction${overrideCount===1?'':'s'} on this device`;
  const exportBtn = document.getElementById('kExportPatch');
  if(exportBtn){
    exportBtn.textContent = `Export patch (${overrideCount})`;
    exportBtn.disabled = overrideCount === 0;
  }
}
