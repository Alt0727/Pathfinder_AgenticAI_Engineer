// WhatsApp connection: QR login, session saved in auth/, reconnect on close.
// The bot only reads: there is no code anywhere that sends a WhatsApp message.
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from 'baileys'
import { rm } from 'fs/promises'
import { fileURLToPath } from 'url'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

// apps/listener/auth/ = the logged-in WhatsApp account. Gitignored, never read by Claude Code.
const AUTH_DIR = fileURLToPath(new URL('../../auth/', import.meta.url))

let sock = null
let connected = false

// The current socket, or null while disconnected (invites wait for the next connect).
export const getSocket = () => (connected ? sock : null)

export async function startSocket({ onOpen, onMessages }) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),   // Baileys' own logs can contain message content
    browser: Browsers.ubuntu('unmute'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('scan with the burner phone: WhatsApp → Linked devices → Link a device')
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') {
      connected = true
      console.log('connected')
      onOpen()
    }
    if (connection === 'close') {
      connected = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.connectionReplaced) {
        console.log('another listener took over this session: stopping')
        process.exit(1)
      }
      if (code === DisconnectReason.loggedOut) {
        console.log('logged out: wiping auth/, a new QR follows')
        await rm(AUTH_DIR, { recursive: true, force: true })
      } else {
        console.log(`(reconnecting${code ? `, code ${code}` : ''})`)
      }
      // 515 = WhatsApp asks for an immediate restart right after the QR scan
      setTimeout(() => startSocket({ onOpen, onMessages }), code === DisconnectReason.restartRequired ? 0 : 3000)
    }
  })

  // 'notify' = new live messages. 'append' (history sync, old messages) is ignored.
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type === 'notify') onMessages(messages)
  })
}
