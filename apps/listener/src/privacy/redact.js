// Redact: replaces personal details with placeholders before a message leaves the laptop.
// Rules: docs/2-spec/security-privacy.md → data pipeline, step 3. Order matters.

const RULES = [
  // wa.me links contain a phone number
  [/(?:https?:\/\/)?wa\.me\/\+?\d+/gi, '[phone]'],
  // emails, before @mentions (both contain @)
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  // WhatsApp @mentions (@919876543210 or @Name)
  [/@[\p{L}\p{N}_.]+/gu, '[mention]'],
  // phone numbers: 10+ digits, optional +country code, spaces/dashes allowed (98765 43210, +91-9876543210).
  // Dates like 2026-10-24 have only 8 digits, so they survive.
  [/(?<![\w/])(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,12}\d(?![\w/])/g, '[phone]'],
]

export function redact(text) {
  return RULES.reduce((t, [re, placeholder]) => t.replace(re, placeholder), text ?? '')
}
