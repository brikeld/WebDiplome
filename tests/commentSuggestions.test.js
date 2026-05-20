import { describe, it, expect } from 'vitest';
import {
  parseCommentSuggestionsResponse,
  parseSingleSuggestionContent,
  parsePrefillSuggestion,
} from '../server/lib/commentSuggestions.js';

describe('parseCommentSuggestionsResponse', () => {
  it('parses canonical suggestions array', () => {
    const raw = JSON.stringify({
      suggestions: [
        { persona: 'productivite', content: 'Shipped the queue before lunch.' },
        { persona: 'securite', content: 'Rotated keys after that push.' },
        { persona: 'popularite', content: 'Posted the recap for the team.' },
      ],
    });
    const out = parseCommentSuggestionsResponse(raw);
    expect(out.productivite).toBeTruthy();
    expect(out.securite).toBeTruthy();
    expect(out.popularite).toBeTruthy();
  });

  it('parses English persona keys', () => {
    const raw = JSON.stringify({
      suggestions: [
        { persona: 'productivity', content: 'Focus block held.' },
        { persona: 'security', content: 'Checked the diff twice.' },
        { persona: 'social', content: 'Shared the win.' },
      ],
    });
    const out = parseCommentSuggestionsResponse(raw);
    expect(out.productivite).toBe('Focus block held.');
    expect(out.securite).toBe('Checked the diff twice.');
    expect(out.popularite).toBe('Shared the win.');
  });

  it('parses markdown fenced JSON', () => {
    const raw = '```json\n{"suggestions":[{"persona":"productivite","content":"A"},{"persona":"securite","content":"B"},{"persona":"popularite","content":"C"}]}\n```';
    const out = parseCommentSuggestionsResponse(raw);
    expect(out.productivite).toBe('A');
  });

  it('parses object keyed by persona', () => {
    const raw = JSON.stringify({
      productivite: { content: 'One' },
      securite: { content: 'Two' },
      popularite: { content: 'Three' },
    });
    const out = parseCommentSuggestionsResponse(raw);
    expect(out.productivite).toBe('One');
    expect(out.popularite).toBe('Three');
  });

  it('parses single content after thinking prose', () => {
    const raw = `Here's my thinking process...
1. Analyze the post
{"content":"Shipped before lunch, tabs be damned."}`;
    const out = parseSingleSuggestionContent(raw);
    expect(out).toBe('Shipped before lunch, tabs be damned.');
  });

  it('uses the last content field when thinking mentions content twice', () => {
    const raw = `Thinking Process:
Draft: {"content":"ignore this draft"}
Final: {"content":"Posted the recap for the team."}`;
    const out = parseSingleSuggestionContent(raw);
    expect(out).toBe('Posted the recap for the team.');
  });

  it('parses prefill continuation only', () => {
    expect(parsePrefillSuggestion('Shipped before lunch."}')).toBe('Shipped before lunch.');
  });

  it('parses prefill after thinking then JSON tail', () => {
    const raw = `Thinking Process:
1. Analyze
{"content":"Rotated keys after that push."}`;
    expect(parsePrefillSuggestion(raw)).toBe('Rotated keys after that push.');
  });

  it('rejects prefill bare thinking without a reply', () => {
    expect(parsePrefillSuggestion('Thinking Process:\n1. Analyze the Request')).toBeNull();
  });

  it('clamps content to 60 characters', () => {
    const long = 'x'.repeat(80);
    const raw = JSON.stringify({
      suggestions: [
        { persona: 'productivite', content: long },
        { persona: 'securite', content: 'ok' },
        { persona: 'popularite', content: 'ok' },
      ],
    });
    const out = parseCommentSuggestionsResponse(raw);
    expect(out.productivite.length).toBeLessThanOrEqual(60);
  });
});
