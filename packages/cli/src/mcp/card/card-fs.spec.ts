import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { deleteCardFile, readCardFile, writeCardFile } from './card-fs';
import * as markdown from './card-markdown';

describe('mcp/card — fs helpers (unit)', () => {
  let bunFileSpy: ReturnType<typeof spyOn> | undefined;
  let bunWriteSpy: ReturnType<typeof spyOn> | undefined;
  let parseCardMarkdownSpy: ReturnType<typeof spyOn> | undefined;
  let serializeCardMarkdownSpy: ReturnType<typeof spyOn> | undefined;

  type FakeBunFile = {
    text: () => Promise<string>;
    exists: () => Promise<boolean>;
    delete: () => Promise<void>;
  };

  const fakeFiles = new Map<string, { text?: string; exists?: boolean }>();

  function setFake(path: string, value: { text?: string; exists?: boolean }) {
    fakeFiles.set(path, value);
  }

  function makeFakeBunFile(path: string): FakeBunFile {
    return {
      text: async () => fakeFiles.get(path)?.text ?? '',
      exists: async () => fakeFiles.get(path)?.exists ?? false,
      delete: async () => {
        setFake(path, { ...(fakeFiles.get(path) ?? {}), exists: false });
      },
    };
  }

  beforeEach(() => {
    fakeFiles.clear();
    bunFileSpy = spyOn(Bun as any, 'file').mockImplementation((path: string) => makeFakeBunFile(path));
    bunWriteSpy = spyOn(Bun as any, 'write').mockResolvedValue(0);
    parseCardMarkdownSpy = spyOn(markdown, 'parseCardMarkdown').mockImplementation((_text: string) => {
      return {
        frontmatter: {
          key: 'spec::a',
          type: 'spec',
          summary: 'A',
          status: 'draft',
        },
        body: 'Body\n',
      };
    });
    serializeCardMarkdownSpy = spyOn(markdown, 'serializeCardMarkdown').mockReturnValue('---\n---\nBody\n');
  });

  afterEach(() => {
    bunFileSpy?.mockRestore();
    bunWriteSpy?.mockRestore();
    parseCardMarkdownSpy?.mockRestore();
    serializeCardMarkdownSpy?.mockRestore();
  });

  it('readCardFile reads text and parses markdown', async () => {
    // Arrange
    const path = '/tmp/a.card.md';
    setFake(path, { text: 'md' });
    parseCardMarkdownSpy!.mockReturnValueOnce({
      frontmatter: {
        key: 'spec::x',
        type: 'spec',
        summary: 'X',
        status: 'draft',
      },
      body: 'B\n',
    });

    // Act
    const card = await readCardFile(path);

    // Assert
    expect(bunFileSpy!).toHaveBeenCalledTimes(1);
    expect(bunFileSpy!).toHaveBeenCalledWith(path);
    expect(parseCardMarkdownSpy!).toHaveBeenCalledTimes(1);
    expect(parseCardMarkdownSpy!).toHaveBeenCalledWith('md');
    expect(card.filePath).toBe(path);
    expect(card.frontmatter.key).toBe('spec::x');
    expect(card.body).toBe('B\n');
  });

  it('writeCardFile serializes markdown then writes text', async () => {
    // Arrange
    const path = '/tmp/b.card.md';
    serializeCardMarkdownSpy!.mockReturnValueOnce('out');

    // Act
    await writeCardFile(path, {
      filePath: path,
      frontmatter: {
        key: 'spec::a',
        type: 'spec',
        summary: 'A',
        status: 'draft',
      },
      body: 'Body\n',
    });

    // Assert
    expect(serializeCardMarkdownSpy!).toHaveBeenCalledTimes(1);
    expect(bunWriteSpy!).toHaveBeenCalledTimes(1);
    expect(bunWriteSpy!).toHaveBeenCalledWith(path, 'out');
  });

  it('deleteCardFile does not delete when file is missing', async () => {
    // Arrange
    const path = '/tmp/missing.card.md';
    setFake(path, { exists: false });

    // Act
    await deleteCardFile(path);

    // Assert
    expect(bunFileSpy!).toHaveBeenCalledTimes(1);
    expect(bunFileSpy!).toHaveBeenCalledWith(path);
  });

  it('deleteCardFile deletes when file exists', async () => {
    // Arrange
    const path = '/tmp/existing.card.md';
    setFake(path, { exists: true });

    // Act
    await deleteCardFile(path);

    // Assert
    expect(bunFileSpy!).toHaveBeenCalledTimes(1);
    expect(bunFileSpy!).toHaveBeenCalledWith(path);
    expect(await Bun.file(path).exists()).toBe(false);
  });
});
