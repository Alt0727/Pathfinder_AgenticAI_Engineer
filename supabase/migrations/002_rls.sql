-- 002_rls.sql: row level security on every table (spec: unmute-schema.md → Access rules).
-- Clients may only SELECT. There are no insert/update/delete policies, so every write must go
-- through app-api / planner-agent / the listener, which use the secret key (that bypasses RLS).
-- (select auth.uid()) is evaluated once per query instead of once per row.

alter table raw_messages        enable row level security;
alter table group_invites       enable row level security;
alter table cards               enable row level security;
alter table profiles            enable row level security;
alter table timetable_slots     enable row level security;
alter table timetable_overrides enable row level security;
alter table agent_runs          enable row level security;
alter table agent_questions     enable row level security;
alter table chat_messages       enable row level security;
alter table plan_entries        enable row level security;
alter table card_actions        enable row level security;
alter table user_preferences    enable row level security;

-- raw_messages: no policies at all → only the service key can touch it.

-- Shared content: any signed-in (anonymous) user can read cards.
create policy cards_select on cards
  for select to authenticated using (true);

-- Personal tables: your own rows only.
create policy group_invites_select on group_invites
  for select to authenticated using (requested_by = (select auth.uid()));

create policy profiles_select on profiles
  for select to authenticated using (id = (select auth.uid()));

create policy timetable_slots_select on timetable_slots
  for select to authenticated using (user_id = (select auth.uid()));

create policy timetable_overrides_select on timetable_overrides
  for select to authenticated using (user_id = (select auth.uid()));

create policy agent_runs_select on agent_runs
  for select to authenticated using (user_id = (select auth.uid()));

create policy agent_questions_select on agent_questions
  for select to authenticated using (user_id = (select auth.uid()));

create policy chat_messages_select on chat_messages
  for select to authenticated using (user_id = (select auth.uid()));

create policy plan_entries_select on plan_entries
  for select to authenticated using (user_id = (select auth.uid()));

create policy card_actions_select on card_actions
  for select to authenticated using (user_id = (select auth.uid()));

create policy user_preferences_select on user_preferences
  for select to authenticated using (user_id = (select auth.uid()));
