/* ============================================================
   NOTES — list all tutor notes, filter by tag, export
   ============================================================ */
function viewNotes(mount){
  const notes = getNotes();
  const entries = Object.entries(notes).sort((a,b)=> new Date(b[1].updatedAt)-new Date(a[1].updatedAt));
  const tags = allNoteTags();

  mount.innerHTML = `
    <section class="container">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 class="section-title">Tutor notes</h2>
          <p class="section-sub">${entries.length} note${entries.length===1?'':'s'} across your library.</p>
        </div>
        <div style="display:flex; gap:8px;">
          <select id="nTag"><option value="">All tags</option>${tags.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
          <button class="btn btn-gold" id="nExport">Export JSON</button>
        </div>
      </div>
      <div id="notesList" class="notes-list"></div>
    </section>`;

  document.getElementById('nExport').addEventListener('click', exportAll);
  document.getElementById('nTag').addEventListener('change', renderList);
  renderList();

  function renderList(){
    const tagFilter = document.getElementById('nTag').value;
    const filtered = entries.filter(([,n]) => !tagFilter || (n.tags||[]).includes(tagFilter));
    const box = document.getElementById('notesList');
    if(!filtered.length){
      box.innerHTML = `<p class="mut" style="padding:24px 0;">No notes yet. Tap the note icon on any question in the player to add one.</p>`;
      return;
    }
    box.innerHTML = filtered.map(([key,n])=>{
      const q = qFromKey(key);
      if(!q) return '';
      return `
      <div class="note-card card">
        <div class="note-card-head">
          <span class="mono">T${q.test} &middot; ${q.sid} &middot; Q${q.q}</span>
          <span class="mut">${fmtDate(n.updatedAt)}</span>
        </div>
        <p class="note-text">${esc(n.text)}</p>
        <div class="note-tags">${(n.tags||[]).map(t=>`<span class="pill" style="background:var(--goldsoft); color:var(--ink);">${esc(t)}</span>`).join('')}</div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn btn-sm btn-ghost" data-view-q="${key}">View question</button>
        </div>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-view-q]').forEach(btn=> btn.addEventListener('click', ()=> openQuestionZoom(btn.getAttribute('data-view-q'))));
  }
}
