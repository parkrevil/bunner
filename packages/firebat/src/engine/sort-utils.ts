import type { CouplingHotspot, DependencyFanStat } from '../types';

const sortCouplingHotspots = (items: ReadonlyArray<CouplingHotspot>): ReadonlyArray<CouplingHotspot> => {
  return [...items].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.module.localeCompare(right.module);
  });
};

const sortDependencyFanStats = (items: ReadonlyArray<DependencyFanStat>): ReadonlyArray<DependencyFanStat> => {
  return [...items].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.module.localeCompare(right.module);
  });
};

export { sortCouplingHotspots, sortDependencyFanStats };
