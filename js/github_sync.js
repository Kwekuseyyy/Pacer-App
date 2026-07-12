/* ============================================================
   GITHUB SYNC — pushes answer-key corrections straight to the
   repo's library/answers.json via the GitHub Contents API.
   No backend, no third-party service — just git commits.

   Local overrides (state.js) still apply instantly for scoring
   in this browser. This module additionally persists them to
   the actual source file so every student gets the fix on their
   next load, once GitHub Pages finishes rebuilding.
   ============================================================ */
const GH_LS_KEY = 'bbp_github_config'; // { owner, repo, branch, path, token }

function getGithubConfig(){
  try{ return JSON.parse(localStorage.getItem(GH_LS_KEY)) || null; }
  catch(e){ return null; }
}
function setGithubConfig(cfg){
  localStorage.setItem(GH_LS_KEY, JSON.stringify(cfg));
}
function clearGithubConfig(){
  localStorage.removeItem(GH_LS_KEY);
}
function githubConfigured(){
  const c = getGithubConfig();
  return !!(c && c.owner && c.repo && c.path && c.token);
}

function ghApiUrl(cfg, extra=''){
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}${extra}`;
}

// UTF-8 safe base64 encode/decode (answers.json is ASCII in practice, but be safe)
function b64encode(str){
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(str){
  return decodeURIComponent(escape(atob(str)));
}

async function ghRequest(url, options={}){
  const cfg = getGithubConfig();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers||{}),
    },
  });
  if(!res.ok){
    let detail = '';
    try{ detail = (await res.json()).message; }catch(e){}
    const err = new Error(`GitHub API ${res.status}${detail ? ': '+detail : ''}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Verify token + repo access without writing anything
async function testGithubConnection(){
  const cfg = getGithubConfig();
  if(!cfg) throw new Error('No GitHub config saved yet.');
  const branchParam = cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '';
  const data = await ghRequest(ghApiUrl(cfg, branchParam));
  return { ok:true, sha: data.sha, size: data.size };
}

async function fetchRemoteAnswers(){
  const cfg = getGithubConfig();
  const branchParam = cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : '';
  const data = await ghRequest(ghApiUrl(cfg, branchParam));
  const content = JSON.parse(b64decode(data.content.replace(/\n/g,'')));
  return { content, sha: data.sha };
}

// Push a batch of {test,sid,q,a,p} corrections as ONE commit.
// Fetches the latest remote file first so we never clobber a change
// made outside this browser (e.g. edited straight on GitHub).
async function pushCorrectionsToGithub(corrections){
  if(!corrections.length) return { pushed: 0 };
  const cfg = getGithubConfig();
  if(!cfg) throw new Error('GitHub isn\u2019t connected yet — set that up first.');

  const { content: remote, sha } = await fetchRemoteAnswers();

  for(const c of corrections){
    const t = String(c.test);
    if(!remote[t]) remote[t] = {};
    if(!remote[t][c.sid]) remote[t][c.sid] = {};
    remote[t][c.sid][String(c.q)] = { a: c.a, p: c.p==null ? null : +c.p };
  }

  const label = corrections.length === 1
    ? `T${corrections[0].test} ${corrections[0].sid} Q${corrections[0].q}`
    : `${corrections.length} questions`;
  const message = `Answer key correction: ${label} (via Big Book Pacer Tutor Tools)`;

  const cfg2 = getGithubConfig();
  const body = {
    message,
    content: b64encode(JSON.stringify(remote, null, 2)),
    sha,
    ...(cfg2.branch ? { branch: cfg2.branch } : {}),
  };

  const result = await ghRequest(ghApiUrl(cfg2), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { pushed: corrections.length, commitSha: result.commit && result.commit.sha, commitUrl: result.commit && result.commit.html_url };
}
