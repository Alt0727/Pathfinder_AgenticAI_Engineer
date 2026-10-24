/*
  adapt.js
  The one place where backend rows become the shapes the UI components expect
  (the UI was designed on mock data: items, groups, calendar entries).
  Pure functions: no fetching here.
*/

// The 14 fixed card tags (same list as AI #1 and app-api) → the labels the UI shows
export const TAG_LABELS = {
  hackathon: "Hackathons",
  workshop: "Workshops",
  talk: "Talks",
  placement: "Placements",
  internship: "Internships",
  sports: "Sports",
  cultural: "Cultural",
  club: "Clubs",
  academic: "Academics",
  fest: "Fests",
  competition: "Competitions",
  scholarship: "Scholarships",
  civic: "Civic",
  other: "Other",
}
export const ALL_TAGS = Object.keys(TAG_LABELS)
export const labelFor = (tag) => TAG_LABELS[tag] ?? tag

// A card from the database → the UI's "item"
export function cardToItem(card) {
  return {
    id: card.id,
    title: card.title,
    pillar: card.type, // deadline | event | opportunity | announcement
    description: card.summary ?? "",
    starts_at: card.starts_at,
    ends_at: card.ends_at,
    deadline_at: card.deadline_at,
    venue: card.location,
    link: card.link,
    organizer: card.source_group_name ?? "Campus group",
    source_group: card.source_group_name ?? "Campus group",
    original_message: null, // deleted seconds after AI #1 read it (privacy)
    posted_at: card.created_at,
    interests: (card.tags ?? []).filter((t) => t !== "other").map(labelFor),
    status: card.status,
  }
}

// A plan entry (get_week row) → a calendar tile. Keeps the card's look; the entry's own title and times.
export function entryToItem(entry, cardItem) {
  const isTask = /^register for\b/i.test(entry.title)
  return {
    ...(cardItem ?? {}),
    id: entry.id, // the calendar keys and rings by entry id
    cardId: entry.card_id,
    title: entry.title,
    pillar: isTask ? "deadline" : (cardItem?.pillar ?? "event"),
    starts_at: entry.starts_at,
    ends_at: entry.ends_at,
    deadline_at: isTask ? (cardItem?.deadline_at ?? null) : null,
    placed_by: entry.placed_by,
    reason: entry.reason ?? null,
    end_estimated: entry.end_estimated,
    cancelled: entry.card_status === "cancelled",
    isEntry: true,
  }
}

// A group_invites row → the UI's group (newCount = its cards from the last 24 h)
export function inviteToGroup(invite, cards) {
  const status = invite.status === "joined" ? "listening" : invite.status === "failed" ? "failed" : "joining"
  const dayAgo = Date.now() - 86400_000
  const newCount = invite.group_id
    ? cards.filter((c) => c.source_group_id === invite.group_id && Date.parse(c.created_at) > dayAgo).length
    : 0
  return {
    id: invite.id,
    name: invite.group_name ?? (status === "failed" ? "Couldn't join" : "Joining…"),
    status,
    newCount,
    error: invite.error,
    link: invite.invite_link,
  }
}

// One agent step → a short line for the status bar ("Checking for clashes…")
const STEP_WORDS = {
  get_week: "Reading your week",
  get_preferences: "Reading your preferences",
  check_clash: "Checking for clashes",
  add_entry: "Adding to your week",
  move_entry: "Moving an entry",
  remove_entry: "Removing an entry",
  save_preference: "Remembering a preference",
  override_slot: "Moving a class for one day",
  ask_user: "Asking you something",
  finish: "Wrapping up",
}
export const stepWords = (tool) => STEP_WORDS[tool] ?? tool
