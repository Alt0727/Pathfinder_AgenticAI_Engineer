-- 004_realtime.sql: tables whose changes are pushed live to the browser (spec: unmute-schema.md → Realtime).
-- Realtime respects RLS, so each browser only receives its own rows (cards: everyone).
-- raw_messages, profiles and user_preferences are deliberately not published.

alter publication supabase_realtime add table
  group_invites,
  cards,
  card_actions,
  plan_entries,
  timetable_slots,
  timetable_overrides,
  agent_runs,
  agent_questions,
  chat_messages;
