// Group invites: users add a link in the app → app-api inserts a group_invites row → we join.
// Only groups joined this way are watched; any other group on the bot's number is ignored.

const LINK = /chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,})/

export function createInvites({ supabase, getSocket }) {
  const watchedGroups = new Set()

  // On start: every group we already joined.
  async function loadWatched() {
    const { data, error } = await supabase.from('group_invites').select('group_id').eq('status', 'joined')
    if (error) throw error
    for (const row of data) if (row.group_id) watchedGroups.add(row.group_id)
  }

  async function setStatus(id, fields) {
    const { error } = await supabase.from('group_invites').update(fields).eq('id', id)
    if (error) console.error('invite update failed', id, error.message)
  }

  async function joinInvite(row) {
    const sock = getSocket()
    if (!sock) return   // offline: stays pending, catchUp() picks it up after connect

    // Claim atomically (pending → joining), so a row is never processed twice.
    const { data: claimed } = await supabase
      .from('group_invites')
      .update({ status: 'joining' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
    if (!claimed?.length) return

    const code = row.invite_link?.match(LINK)?.[1]
    if (!code) {
      console.log('invite failed', row.id, '(invalid link)')
      return setStatus(row.id, { status: 'failed', error: 'invalid link' })
    }

    let groupId = null
    try {
      groupId = (await sock.groupGetInviteInfo(code)).id
      await sock.groupAcceptInvite(code)
    } catch (err) {
      // Accept fails if the bot is already a member: then metadata still works and we treat it as joined.
      if (!groupId) {
        console.log('invite failed', row.id, `(${err.message})`)
        return setStatus(row.id, { status: 'failed', error: String(err.message).slice(0, 200) })
      }
    }

    try {
      const meta = await sock.groupMetadata(groupId)
      watchedGroups.add(groupId)
      await setStatus(row.id, { status: 'joined', group_id: groupId, group_name: meta.subject, error: null })
      console.log(`joined ${meta.subject}`)
    } catch (err) {
      console.log('invite failed', row.id, `(${err.message})`)
      await setStatus(row.id, { status: 'failed', error: String(err.message).slice(0, 200) })
    }
  }

  // After every connect: links added while the listener was off or offline.
  async function catchUp() {
    const { data, error } = await supabase
      .from('group_invites')
      .select('*')
      .eq('status', 'pending')
      .order('created_at')
    if (error) return console.error('catch-up failed', error.message)
    for (const row of data) await joinInvite(row)
  }

  // ONE realtime subscription for the whole run: new invite rows are joined immediately.
  function subscribe() {
    supabase
      .channel('group_invites')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_invites' }, ({ new: row }) => {
        if (row.status === 'pending') joinInvite(row)
      })
      .subscribe((status) => console.log(`realtime: ${status}`))
  }

  return { watchedGroups, loadWatched, catchUp, subscribe }
}
