import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PersonaDeltaSummary from '../src/features/harvest/PersonaDeltaSummary.jsx';

describe('<PersonaDeltaSummary>', () => {
  it('renders dashboard-style persona boxes for all three score axes', () => {
    const html = renderToStaticMarkup(
      <PersonaDeltaSummary
        deltas={{ productivity: 3, security: 0, social: -1 }}
        scores={{ productivity: 64, security: 72, social: 58 }}
      />,
    );

    expect(html.match(/class="persona-delta-card(?:\s|")/g)?.length).toBe(3);
    expect(html).toContain('productivity');
    expect(html).toContain('security');
    expect(html).toContain('social');
    expect(html).toContain('+3');
    expect(html).toContain('=');
    expect(html).toContain('-1');
  });
});
