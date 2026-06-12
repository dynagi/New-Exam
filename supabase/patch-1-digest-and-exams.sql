-- ============================================================
-- SecureAIExam — Patch 1: run ONCE in the SQL Editor of an
-- EXISTING project (fresh projects get all of this from schema.sql).
--
-- 1. Fixes "function digest(text, unknown) does not exist" when
--    sealing a paper: Supabase installs pgcrypto in the `extensions`
--    schema, but the hash-chain trigger functions pinned
--    search_path = public, so digest() was never found.
--
-- 2. Exam categories: every question and paper now belongs to an
--    exam scheduled by the Admin. Teachers can only submit questions
--    for a scheduled exam; setters compose papers within one exam.
-- ============================================================

-- ---------- 1. digest() fix ----------
create extension if not exists pgcrypto with schema extensions;

alter function public.audit_chain() set search_path = public, extensions;
alter function public.custody_chain() set search_path = public, extensions;

-- ---------- 2. Exam categories ----------
alter table public.questions add column if not exists exam_id uuid references public.exams (id);
alter table public.papers add column if not exists exam_id uuid references public.exams (id);
create index if not exists idx_questions_exam on public.questions (exam_id);
create index if not exists idx_papers_exam on public.papers (exam_id);

-- Teachers may only submit questions for an exam the Admin has scheduled.
drop policy if exists "teachers insert own questions" on public.questions;
create policy "teachers insert own questions" on public.questions
  for insert to authenticated
  with check (
    auth.uid() = teacher_id
    and public.get_my_role() = 'teacher'
    and exists (
      select 1 from public.exams e
      where e.id = exam_id and e.status = 'scheduled'
    )
  );

-- Setters' drafts must target a scheduled exam too.
drop policy if exists "setters create drafts" on public.papers;
create policy "setters create drafts" on public.papers
  for insert to authenticated
  with check (
    auth.uid() = setter_id
    and public.get_my_role() = 'paper_setter'
    and status = 'draft'
    and exists (
      select 1 from public.exams e
      where e.id = exam_id and e.status = 'scheduled'
    )
  );

-- Realtime on exams so teacher/setter pickers update the moment
-- the Admin schedules one.
alter table public.exams replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.exams;
exception
  when duplicate_object then null;
end $$;

-- Note: questions/papers created before this patch have exam_id NULL.
-- They stay readable but won't appear under any exam category.
