import { describe, expect, it } from 'bun:test';

import { parseCardMarkdown, serializeCardMarkdown } from './card-markdown.ts';

describe('mcp/card — card markdown', () => {
  it('parses YAML frontmatter + body', () => {
    const md = `---
key: spec::auth/login
type: spec
summary: OAuth login
status: draft
keywords:
  - auth
  - mvp
relations:
  - type: depends_on
    target: spec::auth/session
---
# Spec
Hello\n`;

    const card = parseCardMarkdown(md);

    expect(card.frontmatter.key).toBe('spec::auth/login');
    expect(card.frontmatter.type).toBe('spec');
    expect(card.frontmatter.status).toBe('draft');
    expect(card.frontmatter.keywords).toEqual(['auth', 'mvp']);
    expect(card.frontmatter.relations).toEqual([
      { type: 'depends_on', target: 'spec::auth/session' },
    ]);
    expect(card.body).toBe('# Spec\nHello\n');
  });

  it('supports CRLF markdown', () => {
    const md = `---\r\nkey: spec::a\r\ntype: spec\r\nsummary: A\r\nstatus: draft\r\n---\r\nBody\r\n`;
    const card = parseCardMarkdown(md);
    expect(card.frontmatter.key).toBe('spec::a');
    expect(card.body).toBe('Body\n');
  });

  it('throws when frontmatter is missing', () => {
    expect(() => parseCardMarkdown('# no frontmatter\n')).toThrow();
  });

  it('throws when YAML is invalid', () => {
    const md = `---\nkey: [\n---\nbody\n`;
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('serializeCardMarkdown round-trips', () => {
    const md = serializeCardMarkdown(
      {
        key: 'spec::k',
        type: 'spec',
        summary: 'S',
        status: 'accepted',
        keywords: ['a', 'b'],
        relations: [{ type: 'related', target: 'spec::x' }],
      },
      'Body\n',
    );

    const parsed = parseCardMarkdown(md);
    expect(parsed.frontmatter).toEqual({
      key: 'spec::k',
      type: 'spec',
      summary: 'S',
      status: 'accepted',
      keywords: ['a', 'b'],
      relations: [{ type: 'related', target: 'spec::x' }],
    });
    expect(parsed.body).toBe('Body\n');
  });
});
