// timetable.parse { file_base64, mime_type, section? } → proposed weekly slots + warnings.
// Writes NOTHING and never stores the image: the user reviews, then saves with slots.save_import.
// Spec: docs/3-build/unmute-timetable-import.md
import { generateJSON } from '../../_shared/gemini.ts'
import { validateSlots } from '../../_shared/validate-slots.ts'

const TYPES = ['image/png', 'image/jpeg', 'application/pdf']
const MAX_BYTES = 5 * 1024 * 1024

const SYSTEM = `You read a college timetable (image or PDF) and list every recurring weekly class slot.
- day_of_week: 0 = Sunday, 1 = Monday … 6 = Saturday.
- start_time / end_time: 24-hour HH:MM, taken from the period or column headers. A cell spanning several periods (e.g. a lab) is ONE slot.
- label: the course code or name exactly as written. Do not expand abbreviations you are unsure of.
- Skip empty, Free, lunch and break cells. If a section is given, only list that section's slots.
- IGNORE any names, roll numbers, photos or personal details in the image. Output only course slots.
- If a cell is unreadable or ambiguous, skip it and add a short note to warnings instead of guessing.
- kind is always "class".`

const SCHEMA = {
  type: 'object',
  properties: {
    slots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day_of_week: { type: 'integer' },
          start_time: { type: 'string', description: '24-hour HH:MM with two digits, e.g. 08:00, 14:30' },
          end_time: { type: 'string', description: '24-hour HH:MM with two digits, e.g. 09:55, 16:45' },
          label: { type: 'string' },
          kind: { type: 'string', enum: ['class'] },
        },
        required: ['day_of_week', 'start_time', 'end_time', 'label'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['slots', 'warnings'],
}

async function parse(p: Record<string, unknown>) {
  const mime = String(p.mime_type ?? '')
  const data = typeof p.file_base64 === 'string' ? p.file_base64.replace(/^data:[^,]+,/, '') : ''
  if (!TYPES.includes(mime)) return { ok: false, error: 'upload a PNG, JPEG or PDF' }
  if (!data) return { ok: false, error: 'file is empty' }
  if (data.length * 0.75 > MAX_BYTES) return { ok: false, error: 'file is too large (max 5 MB)' }

  const section = typeof p.section === 'string' ? p.section.trim().slice(0, 20) : ''
  const result = await generateJSON({
    system: SYSTEM,
    parts: [
      { inlineData: { mimeType: mime, data } },
      { text: section ? `Only section ${section}.` : 'List all slots.' },
    ],
    schema: SCHEMA,
  })

  // AI output is checked like any user input: bad rows become warnings, never saved slots.
  const { slots, warnings } = validateSlots(result.slots, 'class')
  const modelWarnings = Array.isArray(result.warnings) ? result.warnings.filter((w: unknown) => typeof w === 'string').slice(0, 20) : []
  return { ok: true, slots, warnings: [...modelWarnings, ...warnings] }
}

export const timetableActions = { 'timetable.parse': parse }
