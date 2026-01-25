export function splitLines(text: string | null): string[] {
  if (text == null || text === '') {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter((line): line is string => line.length > 0);
}
