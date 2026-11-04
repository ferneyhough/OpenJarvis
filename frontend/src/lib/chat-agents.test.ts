import { describe, expect, it } from 'vitest';
import { resolveAgent, routeAgent } from './chat-agents';

describe('routeAgent', () => {
  it('routes by task', () => {
    expect(routeAgent('I get a traceback when I run this')).toBe('debug');
    expect(routeAgent('please review my code')).toBe('review');
    expect(routeAgent('plan the steps to migrate')).toBe('plan');
    expect(routeAgent('proofread this paragraph')).toBe('edit');
    expect(routeAgent('compare postgres vs mysql')).toBe('research');
    expect(routeAgent('explain how does the router work')).toBe('explore');
    expect(routeAgent('build a todo app')).toBe('agent');
  });

  it('falls back to ask', () => {
    expect(routeAgent('hello')).toBe('ask');
    expect(routeAgent('  ')).toBe('ask');
  });
});

describe('resolveAgent', () => {
  it('uses the chosen mode unless auto', () => {
    expect(resolveAgent('plan', 'build a thing').id).toBe('plan');
    expect(resolveAgent('auto', 'build a thing').id).toBe('agent');
  });
});
