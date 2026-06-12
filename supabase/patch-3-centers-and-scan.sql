-- ============================================================
-- SecureAIExam — Patch 3: Exam centers, per-copy allocation,
-- invigilator scan-in, and pre-exam reconciliation.
-- Run ONCE in the SQL Editor (idempotent).
--
-- Model:
--   * Each exam has one or more exam_centers, each with a start time.
--   * Printed copies are allocated to a center (paper_copies.center_id).
--   * An invigilator scans a copy's QR at the center -> scanned_at is set,
--     so the copy leaves the center's "pending scan" set. (We mark, not
--     delete, to keep the tamper-evident custody chain + fingerprint intact.)
--   * 20 minutes before a center's start time, the crypto service flags any
--     unscanned copies with a CRITICAL alert (reconciled_at prevents repeats).
-- ============================================================

create table if not exists public.exam_centers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  name text not null,
  code text not null,
  starts_at timestamptz not null,
  reconciled_at timestamptz,           -- set once the 20-min check has run
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.paper_copies
  add column if not exists center_id uuid references public.exam_centers (id),
  add column if not exists scanned_at timestamptz,
  add column if not exists scanned_by uuid references public.profiles (id);

create index if not exists idx_centers_exam on public.exam_centers (exam_id);
create index if not exists idx_centers_due on public.exam_centers (starts_at) where reconciled_at is null;
create index if not exists idx_copies_center on public.paper_copies (center_id);
create index if not exists idx_copies_unscanned on public.paper_copies (center_id) where scanned_at is null;

-- ---------- RLS ----------
alter table public.exam_centers enable row level security;

do $$ begin
  create policy "admins manage centers" on public.exam_centers
    for all to authenticated
    using (public.get_my_role() = 'admin')
    with check (public.get_my_role() = 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated read centers" on public.exam_centers
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- ---------- Realtime (live allocation + scan progress on the admin UI) ----------
alter table public.exam_centers replica identity full;
alter table public.paper_copies replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.exam_centers;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.paper_copies;
exception when duplicate_object then null; end $$;
