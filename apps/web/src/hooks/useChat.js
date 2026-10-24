import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// Chat thread: the last 30 messages, oldest first (send via api('chat.send', { text })).
export function useChat(userId) {
  const { data, ...rest } = useLive('chat', ['chat_messages'], async () => {
    const rows = await must(
      supabase.from('chat_messages').select('id, role, text, run_id, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    )
    return rows.reverse()
  }, !!userId)
  return { messages: data ?? [], ...rest }
}
