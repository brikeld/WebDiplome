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

    expect(html).toContain('tell-morph');
    expect(html).toContain('tell-idle-a');
    expect(html).toContain('tell-idle-a__bars');
    expect(html).toContain('Security post');
    expect(html).toContain('Tell me why');
    expect(html).not.toContain('Building inference chain');
  });

  it('renders expanded post analysis immediately when expanded', () => {
    const html = renderToStaticMarkup(<TellMeMorePill highlightedPost={post} expanded />);

    expect(html).toContain('tell-morph__layer--panel');
    expect(html).toContain('tell-panel-a');
    expect(html).toContain('tell-panel-a--alt-palette-2');
    expect(html).toContain('From data to post');
    expect(html).toContain('panel-a__head">Post</header>');
    expect(html).not.toContain('Why this CONTENT?');
    expect(html).not.toContain('tell-more-pill--expanding');
    expect(html).not.toContain('class="np2"');
  });

  it('marks expanded hidden post analysis as permanently redacted', () => {
    const html = renderToStaticMarkup(
      <TellMeMorePill
        highlightedPost={post}
        expanded
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
