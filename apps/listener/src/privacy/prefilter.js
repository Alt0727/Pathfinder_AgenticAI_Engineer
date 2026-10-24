// Prefilter: drops personal chatter ON THE LAPTOP, before anything is stored or sent to Gemini.
// Rules: docs/2-spec/security-privacy.md → data pipeline, step 2.
// Rule of thumb: never drop a real announcement (recall first); AI #1 handles the rest.

const MIN_LENGTH = 12

// Whole-message chatter: greetings, thanks, acknowledgements, reactions.
const CHATTER = new RegExp(
  '^(' + [
    'hi+', 'hello+', 'hey+', 'yo',
    'good (morning|afternoon|evening|night)( (all|everyone|guys|folks))?',
    'thanks?( (a lot|so much))?( (all|everyone|guys|sir|ma\'?am|bro))?', 'thank (you|u)( (all|everyone|sir|ma\'?am))?', 'ty',
    'ok(ay)?( (sir|ma\'?am|bro))?', 'k+', 'noted( sir)?', 'done', 'sure', 'yes+', 'no+', 'yeah', 'nope',
    'lol+', 'lmao', 'haha+', 'hehe+', 'congrats', 'congratulations', 'welcome', 'same', 'nice',
  ].join('|') + ')$',
  'i',
)

// An "event signal": something that could make this a deadline, event or announcement.
const SIGNALS = [
  /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b/i,                       // weekday
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i,              // month
  /\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b\d{1,2}:\d{2}\b|\b(noon|midnight)\b/i,           // time
  /\b\d{1,2}(st|nd|rd|th)\b|\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/i,                // date
  /https?:\/\/|www\.|\b[\w-]+\.(com|in|org|gov|edu|io|gle|ly|co)\b/i,               // link
  new RegExp('\\b(' + [
    'regist\\w*', 'regs?', 'deadline', 'last date', 'appl(y|ication|ications)', 'apply',
    'workshop', 'event', 'talk', 'contest', 'drive', 'cancel+ed', 'postponed', 'extended',
    'rescheduled', 'venue', 'forms?', 'exam', 'quiz', 'holiday', 'today', 'tomorrow', 'tonight',
    'seminar', 'webinar', 'hackathon', 'competition', 'trials?', 'recruitment', 'placement',
    'internship', 'scholarship', 'fest', 'submission', 'due',
  ].join('|') + ')\\b', 'i'),
]

// → { keep: boolean, reason: string }
export function prefilter(text) {
  const t = (text ?? '').trim()
  if (t.length < MIN_LENGTH) return { keep: false, reason: 'short' }
  if (!/[\p{L}\p{N}]/u.test(t)) return { keep: false, reason: 'emoji/punctuation only' }

  // Compare chatter on letters + spaces only ("Thanks sir!! 🙏" → "thanks sir")
  const words = t.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (CHATTER.test(words)) return { keep: false, reason: 'chatter' }

  if (!SIGNALS.some((re) => re.test(t))) return { keep: false, reason: 'no event signal' }
  return { keep: true, reason: 'event signal' }
}
