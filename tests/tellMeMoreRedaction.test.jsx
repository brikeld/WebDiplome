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
  it('renders the idle dashboard prompt face for the current persona', () => {
    const html = renderToStaticMarkup(
      <TellMeMorePill fallbackPersona="security" expanded={false} />,
    );

    expect(html).toContain('<button');
    expect(html).toContain('tell-idle-a');
    expect(html).toContain('tell-idle-a__bars');
    expect(html).toContain('Security post');
    expect(html).toContain('Tell me why');
  });

  it('shows an expansion loading state before rendering post analysis', () => {
    const html = renderToStaticMarkup(<TellMeMorePill highlightedPost={post} expanded />);

    expect(html).toContain('tell-more-pill--expanding');
    expect(html).toContain('tell-load');
    expect(html).not.toContain('Sensitive browser history');
  });

  it('uses the new tell-panel design for expanded normal post analysis', () => {
    const html = renderToStaticMarkup(
      <TellMeMorePill highlightedPost={post} expanded skipExpansionLoading />,
    );

    expect(html).toContain('tell-panel-a');
    expect(html).toContain('tell-panel-a--alt-palette-2');
    expect(html).toContain('From data to post');
    expect(html).not.toContain('class="np2"');
  });

  it('marks expanded hidden post analysis as permanently redacted', () => {
    const html = renderToStaticMarkup(
      <TellMeMorePill
        highlightedPost={post}
        expanded
        skipExpansionLoading
        isAnalysisRedacted
        onRedactedUnhideConfirm={() => {}}
      />,
    );

    expect(html).toContain('tell-more-pill--redacted');
    expect(html).toContain('inference-panel--redacted');
    expect(html).toContain('Hidden post analysis remains blurred');
    expect(html).toContain('Unhide this post?');
    expect(html).toContain('Unhide anyway');
  });

  it('does not redact visible leaderboard ranking analysis by default', () => {
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
        skipExpansionLoading
      />,
    );

    expect(html).not.toContain('tell-more-pill--redacted');
    expect(html).not.toContain('Hidden post analysis remains blurred');
    expect(html).not.toContain('Hidden ranking analysis remains blurred');
  });

  it('redacts hidden leaderboard ranking analysis with ranking-specific copy', () => {
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
        skipExpansionLoading
        isAnalysisRedacted
        onRedactedUnhideConfirm={() => {}}
      />,
    );

    expect(html).toContain('tell-more-pill--redacted');
    expect(html).toContain('inference-panel--redacted');
    expect(html).toContain('Hidden ranking analysis remains blurred');
    expect(html).toContain('Reveal the ranking to inspect the analysis.');
    expect(html).toContain('Unhide your ranking?');
    expect(html).toContain('Show ranking');
    expect(html).not.toContain('Hidden post analysis remains blurred');
  });
});
