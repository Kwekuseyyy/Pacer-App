-- Big Book Pacer — Supabase schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run

-- ============================================================
-- 1. Student roster (access control — who is allowed to log in)
-- ============================================================
create table public.students (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  invited_at timestamptz default now(),
  active boolean default true
);

alter table public.students enable row level security;

-- Only the tutor's own account can add/edit/remove roster entries.
-- Replace the email below with your actual login email before running.
create policy "tutor manages roster"
on public.students for all
using (auth.jwt() ->> 'email' = 'kwekuseyyy@gmail.com')
with check (auth.jwt() ->> 'email' = 'kwekuseyyy@gmail.com');

-- Every logged-in student needs to check whether THEIR OWN email is on the
-- roster and active, to get past the login gate — nothing else about the
-- roster is visible to them (they can't see other students' rows).
create policy "a student can check their own roster row"
on public.students for select
using (auth.jwt() ->> 'email' = email);


-- ============================================================
-- 2. Results — one row per finished section (score summary only,
--    not full question-by-question detail, which stays local)
-- ============================================================
create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_email text not null references public.students(email) on delete cascade,
  test int not null,
  section text not null,
  kind text not null,          -- 'verbal' | 'quant' | 'cr'
  correct int not null,
  scorable int not null,
  accuracy numeric,
  seconds_taken int,
  created_at timestamptz default now()
);

alter table public.results enable row level security;

-- A student can insert and read only their own results rows.
create policy "a student can insert their own results"
on public.results for insert
with check (auth.jwt() ->> 'email' = student_email);

create policy "a student can read their own results"
on public.results for select
using (auth.jwt() ->> 'email' = student_email);

-- The tutor can read every student's results (for the admin dashboard).
create policy "tutor can read all results"
on public.results for select
using (auth.jwt() ->> 'email' = 'kwekuseyyy@gmail.com');
