// The JSON shape Gemini must return (docs/3-build/unmute-ai-plan.md → AI #1 → OUT).
export const TYPES = ['deadline', 'event', 'opportunity', 'announcement']
export const TAGS = [
  'hackathon', 'workshop', 'talk', 'placement', 'internship', 'sports', 'cultural',
  'club', 'academic', 'fest', 'competition', 'scholarship', 'civic', 'other',
]

const nullableString = { type: ['string', 'null'] }

export const schema = {
  type: 'object',
  properties: {
    // One decision per message: is it a campus announcement at all?
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { message_id: { type: 'string' }, relevant: { type: 'boolean' } },
        required: ['message_id', 'relevant'],
      },
    },
    // What to do to the card list. Update fields hold ONLY what changed.
    operations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['create', 'update', 'cancel'] },
          card_id: nullableString,
          source_message_ids: { type: 'array', items: { type: 'string' } },
          fields: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: TYPES },
              title: { type: 'string' },
              summary: nullableString,
              tags: { type: 'array', items: { type: 'string', enum: TAGS } },
              deadline_at: nullableString,
              starts_at: nullableString,
              ends_at: nullableString,
              location: nullableString,
              link: nullableString,
            },
          },
        },
        required: ['op', 'card_id', 'source_message_ids', 'fields'],
      },
    },
  },
  required: ['decisions', 'operations'],
}
