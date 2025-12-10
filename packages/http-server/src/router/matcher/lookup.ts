export function findStaticChild(
  staticPtr: number,
  staticCount: number,
  segment: string,
  staticChildrenBuffer: Uint32Array,
  stringTable: ReadonlyArray<string>,
): number {
  // Optimization: Binary Search for static children
  // Threshold: 8 items. Below 8, linear scan is often faster due to locality/branch prediction.
  if (staticCount < 8) {
    let ptr = staticPtr;
    for (let i = 0; i < staticCount; i++) {
      const sID = staticChildrenBuffer[ptr]!;
      // Direct string comparison is fast in JS engine (interned strings)
      if (stringTable[sID] === segment) {
        return staticChildrenBuffer[ptr + 1]!;
      }
      ptr += 2;
    }
  } else {
    let low = 0;
    let high = staticCount - 1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      const ptr = staticPtr + (mid << 1);
      const sID = staticChildrenBuffer[ptr]!;
      const midVal = stringTable[sID]!;

      if (midVal === segment) {
        return staticChildrenBuffer[ptr + 1]!;
      }

      if (midVal < segment) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
  }
  return -1;
}
