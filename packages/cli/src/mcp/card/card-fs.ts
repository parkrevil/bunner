import type { CardFile } from './types';

import { parseCardMarkdown, serializeCardMarkdown } from './card-markdown';

export async function readCardFile(filePath: string): Promise<CardFile> {
  const text = await Bun.file(filePath).text();
  const parsed = parseCardMarkdown(text);
  return { ...parsed, filePath };
}

export async function writeCardFile(filePath: string, card: CardFile): Promise<void> {
  const text = serializeCardMarkdown(card.frontmatter, card.body);
  await Bun.write(filePath, text);
}

export async function deleteCardFile(filePath: string): Promise<void> {
  const file = Bun.file(filePath);
  if (await file.exists()) {
    await file.delete();
  }
}
