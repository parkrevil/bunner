interface VirtualFs {
  fileExists(filePath: string): boolean;
  readFile(filePath: string): string | null;
}

const createVirtualFs = (entries: Array<[string, string]>): VirtualFs => {
  const storage = new Map(entries);

  const fileExists = (filePath: string): boolean => storage.has(filePath);

  const readFile = (filePath: string): string | null => {
    const value = storage.get(filePath);

    if (typeof value === 'string') {
      return value;
    }

    return null;
  };

  return { fileExists, readFile };
};

export { createVirtualFs };
