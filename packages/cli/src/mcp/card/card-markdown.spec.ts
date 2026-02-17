import { describe, expect, it } from 'bun:test';

import { parseCardMarkdown, serializeCardMarkdown } from './card-markdown.ts';

describe('mcp/card — card markdown', () => {
  it('parses YAML frontmatter + body', () => {
    const md = `---
key: auth/login
summary: OAuth login
status: draft
tags:
  - auth-module
keywords:
  - auth
  - mvp
relations:
  - type: depends-on
    target: auth/session
---
# Spec
Hello\n`;

    const card = parseCardMarkdown(md);

    expect(card.frontmatter.key).toBe('auth/login');
    expect(card.frontmatter.status).toBe('draft');
    expect(card.frontmatter.tags).toEqual(['auth-module']);
    expect(card.frontmatter.keywords).toEqual(['auth', 'mvp']);
    expect(card.frontmatter.relations).toEqual([
      { type: 'depends-on', target: 'auth/session' },
    ]);
    expect(card.body).toBe('# Spec\nHello\n');
  });
  it('parses minimal frontmatter + body (type removed)', () => {
    // Arrange
    const md = `---
key: auth/login
summary: OAuth login
status: accepted
---
Body\n`;

    // Act
    const card = parseCardMarkdown(md);

    // Assert
    expect(card.frontmatter.key).toBe('auth/login');
    expect(card.frontmatter.summary).toBe('OAuth login');
    expect(card.frontmatter.status).toBe('accepted');
    expect(card.body).toBe('Body\n');
  });

  it('parses relations even when relation type is not validated at parse time', () => {
    const md = `---
key: auth/login
summary: OAuth login
status: draft
relations:
  - type: unknown
    target: auth/session
---
Body\n`;

    const card = parseCardMarkdown(md);
    expect(card.frontmatter.relations).toEqual([{ type: 'unknown', target: 'auth/session' }]);
  });

  it('supports CRLF markdown', () => {
    const md = `---\r\nkey: a\r\nsummary: A\r\nstatus: draft\r\n---\r\nBody\r\n`;
    const card = parseCardMarkdown(md);
    expect(card.frontmatter.key).toBe('a');
    expect(card.body).toBe('Body\n');
  });

  it('rejects legacy type-prefixed frontmatter (type field is removed)', () => {
    // Arrange
    const md = `---
key: auth/login
type: spec
summary: OAuth login
status: draft
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
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
        key: 'k',
        summary: 'S',
        status: 'accepted',
        tags: ['core'],
        keywords: ['a', 'b'],
        relations: [{ type: 'related', target: 'x' }],
      },
      'Body\n',
    );

    const parsed = parseCardMarkdown(md);
    expect(parsed.frontmatter).toEqual({
      key: 'k',
      summary: 'S',
      status: 'accepted',
      tags: ['core'],
      keywords: ['a', 'b'],
      relations: [{ type: 'related', target: 'x' }],
    });
    expect(parsed.body).toBe('Body\n');
  });

  it('throws when YAML frontmatter is unterminated', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when frontmatter YAML parses to an array (not an object)', () => {
    // Arrange
    const md = `---
- a
- b
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when frontmatter YAML parses to a scalar (not an object)', () => {
    // Arrange
    const md = `---
hello
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when status is invalid', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: unknown
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when key is missing', () => {
    // Arrange
    const md = `---
summary: A
status: draft
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when summary is missing', () => {
    // Arrange
    const md = `---
key: a
status: draft
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when status is missing', () => {
    // Arrange
    const md = `---
key: a
summary: A
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('parses keywords when keywords is a trimmed string', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
keywords: "  auth  "
---
Body\n`;

    // Act
    const card = parseCardMarkdown(md);

    // Assert
    expect(card.frontmatter.keywords).toEqual(['auth']);
  });

  it('treats keywords empty string as absent', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
keywords: "   "
---
Body\n`;

    // Act
    const card = parseCardMarkdown(md);

    // Assert
    expect(card.frontmatter.keywords).toBeUndefined();
  });

  it('throws when keywords array contains empty string', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
keywords:
  - ok
  - ""
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when keywords is not a string or string array', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
keywords: 123
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when relations is not an array', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
relations: invalid
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when relations contains a non-object item', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
relations:
  - not-an-object
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when relations[].type is missing', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
relations:
  - target: x
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('throws when relations[].target is missing', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
relations:
  - type: related
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('parses constraints as-is when provided', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: accepted
constraints:
  foo: 1
---
Body\n`;

    // Act
    const card = parseCardMarkdown(md);

    // Assert
    expect(card.frontmatter.constraints).toEqual({ foo: 1 });
  });

  it('rejects tags when tags is not a string array', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
tags: core
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('parses tags when tags is a string array', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
tags:
  - core
  - auth
---
Body\n`;

    // Act
    const card = parseCardMarkdown(md);

    // Assert
    expect(card.frontmatter.tags).toEqual(['core', 'auth']);
  });

  it('rejects tags when tags contains an empty string', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
tags:
  - core
  - ""
---
Body\n`;

    // Act & Assert
    expect(() => parseCardMarkdown(md)).toThrow();
  });

  it('treats relations null as absent', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
relations: null
---
Body\n`;

    // Act
    const card = parseCardMarkdown(md);

    // Assert
    expect(card.frontmatter.relations).toBeUndefined();
  });

  it('parses empty relations array', () => {
    // Arrange
    const md = `---
key: a
summary: A
status: draft
relations: []
---
Body\n`;

    // Act
    const card = parseCardMarkdown(md);

    // Assert
    expect(card.frontmatter.relations).toEqual([]);
  });
});
