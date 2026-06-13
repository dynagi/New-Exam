-- ============================================================
-- SecureAIExam — Patch 4: Per-center seat capacity.
-- Run ONCE in the SQL Editor (idempotent).
--
-- Adds an optional seat/slot capacity to each exam center so admins can
-- size a center when provisioning it. 0 = unspecified. Used as guidance
-- for how many copies to allocate to the center.
-- ============================================================

alter table public.exam_centers
  add column if not exists capacity int not null default 0;

alter table public.exam_centers
  add constraint exam_centers_capacity_nonneg check (capacity >= 0);
