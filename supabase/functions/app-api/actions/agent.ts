// chat.send · question.answer · plan.week: start planner-agent runs. Built in build step 8.
const notYet = () => Promise.resolve({ ok: false, error: 'not yet' })

export const agentActions = { 'chat.send': notYet, 'question.answer': notYet, 'plan.week': notYet }
