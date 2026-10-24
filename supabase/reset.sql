-- reset.sql: demo reset. Wipes everything the AIs produced;
-- keeps users, interests (profiles), timetables (timetable_slots) and joined groups (group_invites).
-- Order matters: children before parents.

delete from chat_messages;
delete from agent_questions;
delete from plan_entries;
delete from agent_runs;
delete from timetable_overrides;
delete from card_actions;
delete from user_preferences;
delete from cards;
delete from raw_messages;
