// npm run check: shows what prefilter + redact do to sample lines, then checks the 50 labelled
// messages (no relevant message may be dropped). Needs no .env and touches nothing.
import { readFileSync } from 'fs'
import { prefilter } from './prefilter.js'
import { redact } from './redact.js'

const samples = [
  'HackX regs close Thursday 6pm https://forms.gle/x',
  'lol 😂',
  'call 98765 43210 about the workshop on Friday',
  'Good morning everyone ☀️',
  'Thanks for the update sir!!',
  'Mail cdc@nitk.edu.in or ping @919812345678 before Friday 5pm',
  'Contact +91-9876543210 or wa.me/919876543210 for the fest passes',
  'Quiz 2 on 28/10 in the 8am slot, room 2026-10-24 schedule stays',
  '👍👍👍',
  'anyone up for chai?',
]

console.log('--- 10 sample lines ---')
for (const s of samples) {
  const { keep, reason } = prefilter(s)
  console.log(`${keep ? 'KEEP' : 'DROP'} (${reason})\n  in : ${s}${keep ? `\n  out: ${redact(s)}` : ''}`)
}

const { messages } = JSON.parse(readFileSync(new URL('../../eval/labelled.json', import.meta.url), 'utf8'))
const wronglyDropped = messages.filter((m) => m.expected.relevant && !prefilter(m.text).keep)
const chatterDropped = messages.filter((m) => !m.expected.relevant && !prefilter(m.text).keep)
const chatterTotal = messages.filter((m) => !m.expected.relevant).length

console.log('\n--- labelled.json (50 messages) ---')
console.log(`relevant messages wrongly dropped: ${wronglyDropped.length} (must be 0) ${wronglyDropped.map((m) => m.id).join(' ')}`)
console.log(`chatter dropped on the laptop: ${chatterDropped.length} of ${chatterTotal}`)
