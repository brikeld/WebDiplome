import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TellMeMorePill from '../src/features/inferenceChain/TellMeMorePill.jsx';

const post = {
  id: 'hidden-post',
  persona: 'securite',
  noteColor: '#759AEF',
  content: 'This hidden post should not become readable when selected.',
  inferenceChain: [
    { step: 'data', value: 'Sensitive browser history', source: 'Safari history' },
    { step: 'classify', value: 'Security risk signal' },
    { step: 'infer', value: 'User is non-compliant' },
  ],
};

describe('<TellMeMorePill> hidden redaction', () => {
  it('marks expanded hidden post analysis as permanently redacted', () => {
    const html = renderToStaticMarkup(
      <TellMeMorePill
        highlightedPost={post}
        expanded
        isAnalysisRedacted
      />,
    );

    expect(html).toContain('tell-more-pill--redacted');
    expect(html).toContain('inference-panel--redacted');
    expect(html).toContain('Hidden post analysis remains blurred');
  });

  it('does not redact leaderboard ranking analysis by default', () => {
    const html = renderToStaticMarkup(
      <TellMeMorePill
        highlightedPost={{
          ...post,
          leaderboard: {
            boardId: 'most_secure',
            title: 'Most Secure',
            userRank: 2,
            entries: [],
          },
        }}
        expanded
      />,
    );

    expect(html).not.toContain('tell-more-pill--redacted');
    expect(html).not.toContain('Hidden post analysis remains blurred');
  });
});
