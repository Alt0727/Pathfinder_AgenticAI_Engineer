import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// Questions inbox: the agent's pending ask_user questions (answer via api('question.answer', ...)).
export function useQuestions(userId) {
  const { data, ...rest } = useLive('questions', ['agent_questions'], () =>
    must(
      supabase
        .from('agent_questions')
        .select('id, run_id, question, options, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ),
  !!userId)
  return { questions: data ?? [], ...rest }
}
