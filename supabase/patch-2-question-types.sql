-- ============================================================
-- SecureAIExam — Patch 2: Question types (MCQ + Theoretical) and
-- PDF-sourced questions. Run ONCE in the SQL Editor.
--
-- Adds:
--   * question_type   'mcq' | 'theoretical'
--   * marks           per-question weight (theory papers need it)
--   * source          'manual' | 'pdf'  (where the question came from)
--   * correct_index   made NULLABLE (theory questions have no key)
--   * options         already jsonb default '[]' (empty for theory)
--
-- Existing rows default to question_type='mcq', marks=1, source='manual',
-- so nothing breaks. Safe to run on a project already patched to patch-1.
-- ============================================================

alter table public.questions
  add column if not exists question_type text not null default 'mcq',
  add column if not exists marks int not null default 1,
  add column if not exists source text not null default 'manual';

-- Theory questions carry no answer key — let correct_index be NULL.
alter table public.questions alter column correct_index drop not null;
alter table public.questions alter column correct_index set default null;

-- Guard the enum-like text columns.
do $$
begin
  alter table public.questions
    add constraint questions_question_type_chk
    check (question_type in ('mcq', 'theoretical'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.questions
    add constraint questions_source_chk
    check (source in ('manual', 'pdf'));
exception when duplicate_object then null;
end $$;

-- An MCQ must have its four options + a key; theory must not.
do $$
begin
  alter table public.questions
    add constraint questions_shape_chk
    check (
      (question_type = 'mcq' and jsonb_array_length(options) = 4 and correct_index is not null)
      or
      (question_type = 'theoretical')
    );
exception when duplicate_object then null;
end $$;

create index if not exists idx_questions_type on public.questions (question_type);

-- The teacher-insert RLS policy is column-agnostic (it only checks the
-- teacher_id / role / scheduled-exam conditions), so the new columns and
-- the bulk PDF insert are already covered — no policy change needed.
