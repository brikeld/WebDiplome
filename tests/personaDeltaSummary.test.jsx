import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PersonaDeltaSummary from '../src/features/harvest/PersonaDeltaSummary.jsx';

describe('<PersonaDeltaSummary>', () => {
  it('renders three persona columns with delta percentages', () => {
    const html = renderToStaticMarkup(
      <PersonaDeltaSummary
        deltas={{ productivity: 3, security: 0, social: -1 }}
        scores={{ productivity: 64, security: 72, social: 58 }}
        dominantPersona="security"
      />,
    );

    expect(html.match(/class="persona-delta-card(?:\s|")/g)?.length).toBe(3);
    expect(html).toContain('+3%');
    expect(html).toContain('=');
    expect(html).toContain('-1%');
    expect(html).toContain('persona-delta-card--main');
  });

  it('puts the dominant persona column in the center', () => {
    const html = renderToStaticMarkup(
      <PersonaDeltaSummary
        deltas={{ productivity: -1, security: 8, social: 4 }}
        dominantPersona="security"
      />,
    );
    const articles = html.split('<article').slice(1);
    expect(articles.length).toBe(3);
    expect(articles[1]).toContain('update-delta-col--main');
    expect(articles[1]).toContain('+8%');
  });
});
