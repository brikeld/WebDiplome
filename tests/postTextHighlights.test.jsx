import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PostTextHighlights from '../src/features/inferenceChain/PostTextHighlights.jsx';

describe('PostTextHighlights', () => {
  it('keeps the opening quote on the same line as long highlighted text', () => {
    const content = 'Trying to keep track of all these tools is a lot! I have got 17 apps tracked over the last week.';
    const html = renderToStaticMarkup(
      <PostTextHighlights
        content={content}
        highlights={[{ phrase: content, stepIndex: 0, ingredientIndex: 0 }]}
      />,
    );

    expect(html).toContain('\u201CTrying to keep track');
    expect(html).not.toMatch(/\u201C<\/button>/);
    expect(html).not.toMatch(/<span[^>]*>\u201C<\/span>/);
  });

  it('strips leading whitespace and newlines before quoting', () => {
    const html = renderToStaticMarkup(
      <PostTextHighlights
        content={'\n\n  Hello world'}
        highlights={[]}
      />,
    );

    expect(html).toContain('\u201CHello world\u201D');
    expect(html).not.toContain('\u201C\n');
  });
});
