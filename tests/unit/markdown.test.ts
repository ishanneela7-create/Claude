import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../app/lib/markdown';

describe('renderMarkdown', () => {
  it('renders the basics', () => {
    const html = renderMarkdown('# Title\nSome **bold** and *soft* and `code`\n- one\n- two');
    expect(html).toContain('<h3>Title</h3>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>soft</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
  });

  it('only links to http(s) addresses, safely', () => {
    expect(renderMarkdown('[site](https://example.com)')).toContain('rel="noopener noreferrer"');
    expect(renderMarkdown('[bad](javascript:alert(1))')).not.toContain('<a');
  });

  it('never lets HTML through', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
});
