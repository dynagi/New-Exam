-- ============================================================
-- SecureAIExam — Patch 4: Exam slots (2–3 per day, dynamic) with
-- start/end/duration, and an Invigilator (center) login role.
-- Run in the SQL Editor.
--
-- NOTE: the first statement adds an enum value. Postgres won't let a new
-- enum value be used in the SAME transaction it's created in. The Supabase
-- SQL editor runs this fine as-is, but if you hit
-- "unsafe use of new value of enum type", run JUST this first line on its
-- own, then run the rest.
-- ============================================================

alter type user_role add value if not exists 'invigilator';

-- ---------- Exam-level defaults ----------
alter table public.exams
  add column if not exists duration_min int not null default 180;

-- ---------- Exam slots (a day runs 2–3 slots) ----------
create table if not exists public.exam_slots (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  label text not null,
  slot_no int not null default 1,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_min int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_slots_exam on public.exam_slots (exam_id, slot_no);

-- ---------- Centers gain a slot + a linked invigilator account ----------
alter table public.exam_centers
  add column if not exists slot_id uuid references public.exam_slots (id),
  add column if not exists auth_user_id uuid references auth.users (id);

-- ---------- RLS ----------
alter table public.exam_slots enable row level security;

do $$ begin
  create policy "admins manage slots" on public.exam_slots
    for all to authenticated
    using (public.get_my_role() = 'admin')
    with check (public.get_my_role() = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated read slots" on public.exam_slots
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- ---------- Realtime ----------
alter table public.exam_slots replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.exam_slots;
exception when duplicate_object then null; end $$;
