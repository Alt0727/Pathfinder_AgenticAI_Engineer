-- 001_tables.sql: every table, check, foreign key and index (spec: docs/2-spec/unmute-schema.md).
-- Personal rows always belong to an anonymous auth user and disappear with them (on delete cascade).

-- ---------- Ingest ----------

-- Temporary: already prefiltered + redacted on the laptop. AI #1 deletes rows right after processing.
-- No sender columns, ever.
create table raw_messages (
  id         text primary key,            -- WhatsApp message id (duplicates are ignored by ingest)
  group_id   text not null,
  text       text not null,
  sent_at    timestamptz not null,
  created_at timestamptz not null default now()
);
create index raw_messages_created_at_idx on raw_messages (created_at);

create table group_invites (
  id           uuid primary key default gen_random_uuid(),
  invite_link  text not null,
  status       text not null default 'pending'
               check (status in ('pending', 'joining', 'joined', 'failed')),
  group_id     text,                      -- set when joined
  group_name   text,
  error        text,
  requested_by uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- ---------- Content (shared by all users) ----------

create table cards (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null check (type in ('deadline', 'event', 'opportunity', 'announcement')),
  title              text not null,
  summary            text,
  tags               text[] not null default '{}',
  deadline_at        timestamptz,
  starts_at          timestamptz,
  ends_at            timestamptz,
  location           text,
  link               text,
  status             text not null default 'active' check (status in ('active', 'cancelled')),
  source_group_id    text,
  source_group_name  text,                -- shown on the card ("from NITK Coding Club")
  source_message_ids text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index cards_status_deadline_idx on cards (status, deadline_at);
create index cards_status_starts_idx on cards (status, starts_at);
create index cards_tags_idx on cards using gin (tags);   -- fast "card tags overlap my interests"

-- ---------- Personal ----------

create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  interests  text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table timetable_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),   -- 0 = Sunday
  start_time  time not null,
  end_time    time not null,
  label       text not null,
  kind        text not null default 'class' check (kind in ('class', 'personal')),
  check (end_time > start_time)
);

-- A change to one slot on one date (user-mode agent only). move = new times for that date.
create table timetable_overrides (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  slot_id   uuid not null references timetable_slots (id) on delete cascade,
  date      date not null,
  action    text not null check (action in ('cancel', 'move')),
  starts_at timestamptz,
  ends_at   timestamptz,
  reason    text,
  unique (slot_id, date),
  check (action = 'cancel' or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);

-- ---------- Agent (created before plan_entries, which points at agent_runs) ----------

create table agent_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  trigger     text not null check (trigger in ('new_card', 'card_changed', 'plan_week', 'chat', 'answer')),
  input       jsonb,
  steps       jsonb not null default '[]',  -- every tool call + result, shown live in the run panel
  status      text not null default 'running' check (status in ('running', 'done', 'asked', 'failed')),
  summary     text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index agent_runs_user_created_idx on agent_runs (user_id, created_at);

create table agent_questions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  run_id     uuid not null references agent_runs (id) on delete cascade,
  question   text not null,
  options    jsonb not null default '[]',
  answer     text,
  status     text not null default 'pending' check (status in ('pending', 'answered')),
  created_at timestamptz not null default now()
);

-- Text only, never raw model history.
create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'agent')),
  text       text not null,
  run_id     uuid references agent_runs (id) on delete set null,
  created_at timestamptz not null default now()
);
create index chat_messages_user_created_idx on chat_messages (user_id, created_at);

-- ---------- Plan ----------

create table plan_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  card_id       uuid references cards (id) on delete set null,
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  end_estimated boolean not null default false,   -- end came from defaultEnd() (UI shows "~")
  placed_by     text not null check (placed_by in ('user', 'agent')),   -- the guardrail column
  status        text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  reason        text,                             -- why the agent placed it
  run_id        uuid references agent_runs (id) on delete set null,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index plan_entries_user_starts_idx on plan_entries (user_id, starts_at);

-- One action per user per card (upsert): this is how the feed learns.
create table card_actions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    uuid not null references cards (id) on delete cascade,
  action     text not null check (action in ('added', 'skipped', 'saved')),
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table user_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  key     text not null,       -- e.g. avoid_after
  value   text,                -- e.g. 21:00
  primary key (user_id, key)
);
