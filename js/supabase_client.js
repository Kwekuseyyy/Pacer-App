/* ============================================================
   BIG BOOK PACER — Supabase client + auth/roster/results helpers
   ============================================================ */

// Safe to be public — this is the anon key, meant for browser use.
// Row Level Security policies (see supabase_schema.sql) control what
// it's actually allowed to read/write, not this key itself.
const SUPABASE_URL = 'https://bmosjgwahweajmwwwqul.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtb3NqZ3dhaHdlYWptd3d3cXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDc1OTAsImV4cCI6MjEwMDM4MzU5MH0.2xnBLJC6X09a2WJN7MPA_J65eFQp5q1PKorqZC2tLO0';
const TUTOR_EMAIL = 'kwekuseyy@gmail.com'; // must match supabase_schema.sql

const SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- auth ----------
async function sbSendMagicLink(email){
  const { error } = await SB.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0].split('?')[0] }
  });
  return error ? { ok:false, message: error.message } : { ok:true };
}

async function sbGetSession(){
  const { data } = await SB.auth.getSession();
  return data.session || null;
}

function sbOnAuthChange(cb){
  SB.auth.onAuthStateChange((_event, session) => cb(session));
}

async function sbSignOut(){
  await SB.auth.signOut();
}

function sbIsTutor(session){
  return !!session && session.user.email === TUTOR_EMAIL;
}

// ---------- roster ----------
// Returns { active, name } if this email is on the roster, else null.
// A student who isn't on the roster (or was deactivated) gets null and
// is blocked at the login gate even though their magic link worked —
// having a valid email login is not the same as being invited.
async function sbCheckRoster(email){
  const { data, error } = await SB
    .from('students')
    .select('name, active')
    .eq('email', email)
    .maybeSingle();
  if(error || !data) return null;
  return data;
}

// ---------- results (tutor admin page only) ----------
async function sbListRoster(){
  const { data, error } = await SB.from('students').select('*').order('invited_at', {ascending:false});
  return error ? [] : data;
}

async function sbAddStudent(name, email){
  return SB.from('students').insert({ name, email: email.toLowerCase().trim() });
}

async function sbSetStudentActive(id, active){
  return SB.from('students').update({ active }).eq('id', id);
}

async function sbDeleteStudent(id){
  return SB.from('students').delete().eq('id', id);
}

async function sbListAllResults(){
  const { data, error } = await SB.from('results').select('*').order('created_at', {ascending:false});
  return error ? [] : data;
}

// ---------- results (student side — called from the player) ----------
// Fire-and-forget: a failed push (offline, etc.) never blocks the student
// from seeing their local review screen — it only means the tutor's
// dashboard won't show that one attempt until it's retried.
async function sbPushResult(session, email){
  try{
    const { correct, scorable } = session.score || {correct:0, scorable:0};
    await SB.from('results').insert({
      student_email: email,
      test: session.test,
      section: session.sid,
      kind: session.kind || '',
      correct,
      scorable,
      accuracy: scorable ? +(correct/scorable*100).toFixed(1) : null,
      seconds_taken: Math.round(session.elapsedSec || 0),
    });
  }catch(e){
    console.warn('Result sync skipped (will still show locally):', e);
  }
}
