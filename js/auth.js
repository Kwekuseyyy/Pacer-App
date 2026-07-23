/* ============================================================
   BIG BOOK PACER — auth gate
   Renders a login screen if needed; only calls onReady() once
   there's a valid Supabase session AND that email is on the
   active roster in the students table.
   ============================================================ */

let CURRENT_STUDENT = null; // { email, name } once past the gate

function renderLoginScreen(mount, message){
  mount.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card card">
        <div class="bbp-brand" style="margin-bottom:18px;">
          <span class="brand-mark">BB</span><span class="brand-word">Big Book Pacer</span>
        </div>
        <h2 style="margin:0 0 8px;">Sign in</h2>
        <p style="color:var(--mut); margin:0 0 20px; font-size:14px;">
          Enter the email your tutor registered you with — we'll send a sign-in link, no password needed.
        </p>
        ${message ? `<p style="color:var(--flag); font-size:13.5px; margin:0 0 14px;">${esc(message)}</p>` : ''}
        <input type="email" id="authEmail" placeholder="you@email.com" class="auth-input" autocomplete="email" />
        <button class="btn btn-primary" id="authSend" style="width:100%; margin-top:12px;">Send sign-in link</button>
        <p id="authStatus" style="font-size:13px; color:var(--mut); margin-top:14px;"></p>
      </div>
    </div>`;

  mount.querySelector('#authSend').addEventListener('click', async () => {
    const email = mount.querySelector('#authEmail').value.trim();
    const status = mount.querySelector('#authStatus');
    if(!email || !email.includes('@')){ status.textContent = 'Enter a valid email.'; return; }
    status.textContent = 'Sending…';
    const res = await sbSendMagicLink(email);
    status.textContent = res.ok
      ? 'Check your email for the sign-in link.'
      : `Couldn't send link: ${res.message}`;
  });
}

function renderNotRegisteredScreen(mount, email){
  mount.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card card">
        <h2 style="margin:0 0 8px;">Not registered yet</h2>
        <p style="color:var(--mut); font-size:14px; margin:0 0 20px;">
          ${esc(email)} isn't on the roster for this app yet. Ask your tutor to add you, then try signing in again.
        </p>
        <button class="btn btn-ghost" id="authRetry">Try a different email</button>
      </div>
    </div>`;
  mount.querySelector('#authRetry').addEventListener('click', async () => {
    await sbSignOut();
    renderLoginScreen(mount);
  });
}

// Call once at boot. mount = the element to render into while gating;
// onReady(student) fires once, with {email, name}, when access is confirmed.
async function requireAuth(mount, onReady){
  const session = await sbGetSession();

  if(!session){
    renderLoginScreen(mount);
    sbOnAuthChange((newSession) => { if(newSession) requireAuth(mount, onReady); });
    return;
  }

  const email = session.user.email;

  // The tutor's own account skips the roster check — she manages the
  // roster, she isn't a row in it.
  if(sbIsTutor(session)){
    CURRENT_STUDENT = { email, name: 'Tutor' };
    onReady(CURRENT_STUDENT);
    return;
  }

  const roster = await sbCheckRoster(email);
  if(!roster || roster.active === false){
    renderNotRegisteredScreen(mount, email);
    return;
  }

  CURRENT_STUDENT = { email, name: roster.name };
  onReady(CURRENT_STUDENT);
}
