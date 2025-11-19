export class LengthBitset {
  private words: Uint32Array;

  constructor(initialSize: number = 4) {
    this.words = new Uint32Array(initialSize);
  }

  mark(length: number): void {
    if (length < 0) {
      return;
    }
    const index = length >>> 5;
    this.ensure(index);
    const mask = 1 << (length & 31);
    const current = this.words[index] ?? 0;
    this.words[index] = (current | mask) >>> 0;
  }

  has(length: number): boolean {
    if (length < 0) {
      return false;
    }
    const index = length >>> 5;
    if (index >= this.words.length) {
      return false;
    }
    const mask = 1 << (length & 31);
    const current = this.words[index] ?? 0;
    return (current & mask) !== 0;
  }

  private ensure(index: number): void {
    if (index < this.words.length) {
      return;
    }
    const nextLength = Math.max(this.words.length << 1, index + 1);
    const next = new Uint32Array(nextLength);
    next.set(this.words);
    this.words = next;
  }
}
