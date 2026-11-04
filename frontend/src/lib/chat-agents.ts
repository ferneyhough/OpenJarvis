export type ChatMode =
  | 'auto'
  | 'ask'
  | 'agent'
  | 'plan'
  | 'edit'
  | 'explore'
  | 'review'
  | 'research'
  | 'debug';

export interface ChatAgent {
  id: ChatMode;
  label: string;
  hint: string;
  /** what the agent does, shown next to its replies */
  action: string;
  prompt: string;
}

export const CHAT_AGENTS: readonly ChatAgent[] = [
  {
    id: 'auto',
    label: 'Auto',
    hint: 'Picks the best agent for each message',
    action: 'Routes each request to the best agent',
    prompt: '',
  },
  {
    id: 'ask',
    label: 'Ask',
    hint: 'Answer questions directly',
    action: 'Answering directly',
    prompt: '',
  },
  {
    id: 'agent',
    label: 'Pro',
    hint: 'Work through tasks step by step, acting autonomously',
    action: 'Working through the task step by step',
    prompt:
      'You are in Agent mode. Break the request into steps, carry them out, and report what you did and the result.',
  },
  {
    id: 'plan',
    label: 'Plan',
    hint: 'Produce a plan before doing anything',
    action: 'Drafting a plan (nothing is executed)',
    prompt:
      'You are in Plan mode. Do not execute anything. Reply with a clear, numbered plan with risks and open questions.',
  },
  {
    id: 'edit',
    label: 'Edit',
    hint: 'Return precise edits to the supplied text/code',
    action: 'Returning precise edits',
    prompt:
      'You are in Edit mode. Reply only with the revised text or code (and a one-line summary of changes). Preserve everything not asked to change.',
  },
  {
    id: 'explore',
    label: 'Explore',
    hint: 'Read-only investigation: explain how something works',
    action: 'Investigating and explaining (read-only)',
    prompt:
      'You are in Explore mode. Investigate and explain how things work. Do not change anything. Cite the specific files, functions or facts you rely on and say what you could not verify.',
  },
  {
    id: 'review',
    label: 'Review',
    hint: 'Code review: find real bugs and risks',
    action: 'Reviewing for bugs and risks',
    prompt:
      'You are in Review mode. Review the supplied code or change. Report only meaningful bugs, logic errors, security or reliability risks, ordered by severity, each with a concrete fix. Skip style nitpicks.',
  },
  {
    id: 'research',
    label: 'Research',
    hint: 'Gather and compare information with sources',
    action: 'Researching and comparing options',
    prompt:
      'You are in Research mode. Gather the relevant facts, compare options, state your confidence, and clearly separate what you know from what you are unsure of. Name sources where you can.',
  },
  {
    id: 'debug',
    label: 'Debug',
    hint: 'Diagnose errors and propose a fix',
    action: 'Diagnosing the problem',
    prompt:
      'You are in Debug mode. Identify the most likely root cause of the problem, explain the evidence, then give the smallest fix and how to verify it.',
  },
];

export function getAgent(id: string): ChatAgent {
  return CHAT_AGENTS.find((a) => a.id === id) ?? CHAT_AGENTS[1];
}

const ROUTES: Array<[Exclude<ChatMode, 'auto'>, RegExp]> = [
  ['debug', /\b(error|exception|traceback|stack ?trace|crash(es|ed|ing)?|bug|fails?|failing|broken|not working|doesn'?t work|why (is|does|isn'?t))\b/i],
  ['review', /\b(review|audit|code review|security review|check (this|my) (code|change|diff|pr))\b/i],
  ['plan', /\b(plan|roadmap|steps to|how (should|do) (i|we) (approach|build|structure)|design (a|an|the)|outline|break (this|it) down)\b/i],
  ['edit', /\b(rewrite|rephrase|refactor|fix (the )?(typo|grammar)|proofread|translate|reword|shorten|rename|change .* to)\b/i],
  ['research', /\b(research|compare|versus|\bvs\.?\b|pros and cons|best .* for|alternatives?|latest|what'?s new)\b/i],
  ['explore', /\b(explain|how does|how do .* work|walk me through|where is|what does .* do|understand)\b/i],
  ['agent', /\b(build|create|implement|set ?up|install|generate|write (a|an|the)|make (a|an|me)|automate|do this|run)\b/i],
];

/** Choose an agent for a message; plain questions fall back to Ask. */
export function routeAgent(text: string): Exclude<ChatMode, 'auto'> {
  const t = text.trim();
  if (!t) return 'ask';
  for (const [id, re] of ROUTES) if (re.test(t)) return id;
  return 'ask';
}

export function resolveAgent(mode: string, text: string): ChatAgent {
  if (mode !== 'auto') return getAgent(mode);
  return getAgent(routeAgent(text));
}
