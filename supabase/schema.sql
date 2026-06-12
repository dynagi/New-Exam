-- ============================================================
-- SecureAIExam — Supabase schema
-- Run ONCE in the SQL Editor of a fresh Supabase project.
-- ============================================================

-- Supabase pre-installs pgcrypto in the `extensions` schema; functions
-- that call digest() must include it in their search_path.
create extension if not exists pgcrypto with schema extensions;

-- ---------- Enums ----------
create type user_role as enum ('teacher', 'paper_setter', 'admin', 'invigilator');
create type question_status as enum ('submitted', 'approved', 'used');
create type paper_status as enum ('draft', 'sealed', 'sealed_dual', 'printed', 'distributed', 'completed');
create type copy_status as enum ('printed', 'in_transit', 'at_center', 'delivered', 'missing', 'leaked');
create type alert_severity as enum ('info', 'warning', 'critical');

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Unnamed',
  role user_role not null default 'teacher',
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id),
  subject text not null,
  topic text,
  difficulty text not null default 'medium',
  -- 'mcq' carries 4 options + a correct_index; 'theoretical' carries neither.
  question_type text not null default 'mcq' check (question_type in ('mcq', 'theoretical')),
  marks int not null default 1,
  source text not null default 'manual' check (source in ('manual', 'pdf')),
  body text not null,
  options jsonb not null default '[]',
  correct_index int,
  status question_status not null default 'submitted',
  created_at timestamptz not null default now(),
  constraint questions_shape_chk check (
    (question_type = 'mcq' and jsonb_array_length(options) = 4 and correct_index is not null)
    or (question_type = 'theoretical')
  )
);

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  setter_id uuid not null references public.profiles (id),
  status paper_status not null default 'draft',
  question_count int not null default 0,
  sealed_at timestamptz,
  cosigned_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.paper_questions (
  paper_id uuid not null references public.papers (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  position int not null default 0,
  primary key (paper_id, question_id)
);

-- Ciphertext + wrapped key shares. NO RLS POLICIES on purpose:
-- with RLS enabled and zero policies, no client JWT can ever read
-- this table. Only the Node service (service role) touches it.
create table public.paper_secrets (
  paper_id uuid primary key references public.papers (id) on delete cascade,
  ciphertext text not null,
  cipher_iv text not null,
  cipher_tag text not null,
  share_setter jsonb not null,
  share_admin jsonb,
  escrow_admin jsonb,
  created_at timestamptz not null default now()
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  exam_date date not null,
  duration_min int not null default 180,
  status text not null default 'scheduled',
  paper_id uuid references public.papers (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- A day's exam runs in 2–3 dynamic slots, each with start/end/duration.
create table public.exam_slots (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  label text not null,
  slot_no int not null default 1,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_min int not null,
  created_at timestamptz not null default now()
);

create table public.paper_copies (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers (id) on delete cascade,
  copy_number int not null,
  qr_payload text not null,
  fingerprint_hash text not null,
  fingerprint_method text not null default 'ai-service',
  current_location text not null default 'Printing press',
  status copy_status not null default 'printed',
  -- Per-center allocation + invigilator scan-in (see patch-3).
  center_id uuid,
  scanned_at timestamptz,
  scanned_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (paper_id, copy_number)
);

-- Exam centers: copies are allocated per center; each center has a start
-- time used for the 20-minutes-before reconciliation sweep.
create table public.exam_centers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  slot_id uuid references public.exam_slots (id),
  name text not null,
  code text not null,
  starts_at timestamptz not null,
  reconciled_at timestamptz,
  -- The provisioned invigilator (center) login account.
  auth_user_id uuid references auth.users (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.paper_copies
  add constraint paper_copies_center_fk foreign key (center_id) references public.exam_centers (id);

create table public.custody_events (
  id uuid primary key default gen_random_uuid(),
  copy_id uuid not null references public.paper_copies (id) on delete cascade,
  event_type copy_status not null,
  location text not null,
  note text,
  actor_id uuid references public.profiles (id),
  prev_hash text,
  hash text,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  severity alert_severity not null default 'info',
  type text not null,
  message text not null,
  paper_id uuid references public.papers (id) on delete set null,
  copy_id uuid references public.paper_copies (id) on delete set null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

-- Exam categories (added after exams because of the FK; exams itself
-- references papers, so the column lives here as an alter).
alter table public.questions add column exam_id uuid references public.exams (id);
alter table public.papers add column exam_id uuid references public.exams (id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  prev_hash text,
  hash text,
  created_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index idx_questions_teacher on public.questions (teacher_id);
create index idx_questions_status on public.questions (status);
create index idx_questions_type on public.questions (question_type);
create index idx_questions_exam on public.questions (exam_id);
create index idx_papers_exam on public.papers (exam_id);
create index idx_papers_setter on public.papers (setter_id);
create index idx_papers_status on public.papers (status);
create index idx_copies_paper on public.paper_copies (paper_id);
create index idx_slots_exam on public.exam_slots (exam_id, slot_no);
create index idx_centers_exam on public.exam_centers (exam_id);
create index idx_centers_due on public.exam_centers (starts_at) where reconciled_at is null;
create index idx_copies_center on public.paper_copies (center_id);
create index idx_copies_unscanned on public.paper_copies (center_id) where scanned_at is null;
create index idx_custody_copy on public.custody_events (copy_id, created_at desc);
create index idx_alerts_created on public.alerts (created_at desc);

-- ---------- Helper: current user's role (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.get_my_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- Auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Unnamed'),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'teacher')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Audit log: hash chain + helper ----------
create or replace function public.audit_chain()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  last_hash text;
begin
  select hash into last_hash from public.audit_log order by id desc limit 1;
  new.prev_hash := last_hash;
  new.created_at := coalesce(new.created_at, now());
  new.hash := encode(digest(
    coalesce(last_hash, 'GENESIS')
    || coalesce(new.actor_id::text, 'system')
    || new.action || new.entity
    || coalesce(new.entity_id, '')
    || coalesce(new.details::text, '{}')
    || new.created_at::text,
    'sha256'), 'hex');
  return new;
end;
$$;

create trigger trg_audit_chain
  before insert on public.audit_log
  for each row execute function public.audit_chain();

create or replace function public.write_audit(
  p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_name, action, entity, entity_id, details)
  values (
    p_actor,
    coalesce((select full_name from public.profiles where id = p_actor), 'system'),
    p_action, p_entity, p_entity_id, p_details
  );
end;
$$;

-- Only the service role (Node crypto service) and internal triggers may write audit entries.
revoke execute on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, text, text, text, jsonb) to service_role;

-- ---------- Custody events: per-copy hash chain ----------
create or replace function public.custody_chain()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  last_hash text;
begin
  select hash into last_hash
  from public.custody_events
  where copy_id = new.copy_id
  order by created_at desc
  limit 1;

  new.actor_id := coalesce(new.actor_id, auth.uid());
  new.created_at := coalesce(new.created_at, now());
  new.prev_hash := last_hash;
  new.hash := encode(digest(
    coalesce(last_hash, 'GENESIS')
    || new.copy_id::text
    || new.event_type::text
    || new.location
    || coalesce(new.actor_id::text, 'system')
    || new.created_at::text,
    'sha256'), 'hex');
  return new;
end;
$$;

create trigger trg_custody_chain
  before insert on public.custody_events
  for each row execute function public.custody_chain();

-- ---------- Custody events: update copy + raise alerts ----------
create or replace function public.custody_after_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_copy_number int;
  v_paper_id uuid;
  v_title text;
begin
  update public.paper_copies
  set status = new.event_type, current_location = new.location
  where id = new.copy_id;

  select c.copy_number, c.paper_id, p.title
  into v_copy_number, v_paper_id, v_title
  from public.paper_copies c
  join public.papers p on p.id = c.paper_id
  where c.id = new.copy_id;

  if new.event_type = 'missing' then
    insert into public.alerts (severity, type, message, paper_id, copy_id)
    values ('critical', 'COPY_MISSING',
            format('Copy #%s of "%s" reported MISSING at %s', v_copy_number, v_title, new.location),
            v_paper_id, new.copy_id);
  elsif new.event_type = 'leaked' then
    insert into public.alerts (severity, type, message, paper_id, copy_id)
    values ('critical', 'LEAK_DETECTED',
            format('Copy #%s of "%s" identified as LEAKED (%s)', v_copy_number, v_title, new.location),
            v_paper_id, new.copy_id);
  end if;

  perform public.write_audit(
    new.actor_id, 'CUSTODY_SCAN', 'paper_copy', new.copy_id::text,
    jsonb_build_object('event', new.event_type, 'location', new.location)
  );
  return new;
end;
$$;

create trigger trg_custody_after
  after insert on public.custody_events
  for each row execute function public.custody_after_insert();

-- ---------- Papers: audit every status change ----------
create or replace function public.paper_status_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.write_audit(
      auth.uid(), 'PAPER_STATUS_' || upper(new.status::text), 'paper', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status, 'title', new.title)
    );
  end if;
  return new;
end;
$$;

create trigger trg_paper_status_audit
  after update on public.papers
  for each row execute function public.paper_status_audit();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.papers enable row level security;
alter table public.paper_questions enable row level security;
alter table public.paper_secrets enable row level security;  -- no policies → clients fully blocked
alter table public.exams enable row level security;
alter table public.paper_copies enable row level security;
alter table public.exam_centers enable row level security;
alter table public.exam_slots enable row level security;
alter table public.custody_events enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_log enable row level security;

-- profiles
create policy "authenticated read profiles" on public.profiles
  for select to authenticated using (true);
create policy "update own profile (role locked)" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and role = public.get_my_role());

-- questions (teachers may only submit for an exam the Admin has scheduled)
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
create policy "teachers read own questions" on public.questions
  for select to authenticated using (auth.uid() = teacher_id);
create policy "setters and admins read all questions" on public.questions
  for select to authenticated using (public.get_my_role() in ('paper_setter', 'admin'));
create policy "setters and admins update questions" on public.questions
  for update to authenticated using (public.get_my_role() in ('paper_setter', 'admin'));

-- papers (status changes beyond draft happen via the Node service / service role)
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
create policy "setters read own papers" on public.papers
  for select to authenticated using (auth.uid() = setter_id);
create policy "admins read all papers" on public.papers
  for select to authenticated using (public.get_my_role() = 'admin');

-- paper_questions
create policy "setters add questions to own draft" on public.paper_questions
  for insert to authenticated
  with check (exists (
    select 1 from public.papers p
    where p.id = paper_id and p.setter_id = auth.uid() and p.status = 'draft'
  ));
create policy "read paper questions via paper access" on public.paper_questions
  for select to authenticated
  using (exists (
    select 1 from public.papers p
    where p.id = paper_id and (p.setter_id = auth.uid() or public.get_my_role() = 'admin')
  ));

-- exams
create policy "admins manage exams" on public.exams
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin' and created_by = auth.uid());
create policy "authenticated read exams" on public.exams
  for select to authenticated using (true);

-- paper_copies (inserted by service role at print time; updated by custody trigger)
create policy "admins read copies" on public.paper_copies
  for select to authenticated using (public.get_my_role() = 'admin');

-- exam_centers (admins manage; everyone authenticated can read)
create policy "admins manage centers" on public.exam_centers
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy "authenticated read centers" on public.exam_centers
  for select to authenticated using (true);

-- exam_slots (admins manage; everyone authenticated can read)
create policy "admins manage slots" on public.exam_slots
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy "authenticated read slots" on public.exam_slots
  for select to authenticated using (true);

-- custody_events (in production invigilators get their own role; demo: admin scans)
create policy "admins insert custody events" on public.custody_events
  for insert to authenticated with check (public.get_my_role() = 'admin');
create policy "admins read custody events" on public.custody_events
  for select to authenticated using (public.get_my_role() = 'admin');

-- alerts
create policy "admins read alerts" on public.alerts
  for select to authenticated using (public.get_my_role() = 'admin');
create policy "admins acknowledge alerts" on public.alerts
  for update to authenticated using (public.get_my_role() = 'admin');

-- audit_log (append happens only via triggers / service role)
create policy "admins read audit log" on public.audit_log
  for select to authenticated using (public.get_my_role() = 'admin');

-- ============================================================
-- Realtime
-- ============================================================
alter table public.alerts replica identity full;
alter table public.custody_events replica identity full;
alter table public.papers replica identity full;
alter table public.questions replica identity full;
alter table public.exams replica identity full;
alter table public.exam_centers replica identity full;
alter table public.exam_slots replica identity full;
alter table public.paper_copies replica identity full;

alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.custody_events;
alter publication supabase_realtime add table public.papers;
alter publication supabase_realtime add table public.questions;
alter publication supabase_realtime add table public.exams;
alter publication supabase_realtime add table public.exam_centers;
alter publication supabase_realtime add table public.exam_slots;
alter publication supabase_realtime add table public.paper_copies;
