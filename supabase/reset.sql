-- reset.sql: FULL demo reset, back to an empty app.
-- Deleting the (anonymous) users cascades to everything personal: interests (profiles),
-- timetables + overrides, group invites, plan entries, card actions, preferences,
-- agent runs + questions, chat. Then the shared data: cards and waiting raw messages.
-- After running it: reload the web app → landing page → "Sign in" makes a fresh anonymous user.
-- The listener reloads its watched groups by itself; the bot stays a member of the WhatsApp groups,
-- so re-adding a group link joins it again instantly.

delete from auth.users;
delete from cards;
delete from raw_messages;
