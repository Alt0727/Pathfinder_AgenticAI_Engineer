// Listener entry: WhatsApp → privacy filter → ingest. (AI #1 is wired in at build step 6.)
import { config } from './config.js'
import { supabase } from './lib/supabase.js'
import { createIngest } from './whatsapp/ingest.js'
import { createInvites } from './whatsapp/invites.js'
import { getSocket, startSocket } from './whatsapp/socket.js'

const invites = createInvites({ supabase, getSocket })
await invites.loadWatched()
invites.subscribe()

const handleMessages = createIngest({ config, watchedGroups: invites.watchedGroups })

await startSocket({
  onOpen: async () => {
    console.log(`watching ${invites.watchedGroups.size} group(s)`)
    await invites.catchUp()
  },
  onMessages: handleMessages,
})
