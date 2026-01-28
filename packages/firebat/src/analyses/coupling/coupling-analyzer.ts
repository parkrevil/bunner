import type { CouplingAnalysis, DependencyAnalysis } from '../../types';

const createEmptyCoupling = (): CouplingAnalysis => ({
  hotspots: [],
});

const analyzeCoupling = (dependencies: DependencyAnalysis): CouplingAnalysis => {
  const scoreByModule = new Map<string, number>();
  const signalsByModule = new Map<string, Set<string>>();

  for (const entry of dependencies.fanInTop) {
    const nextScore = (scoreByModule.get(entry.module) ?? 0) + entry.count;
    const signals = signalsByModule.get(entry.module) ?? new Set<string>();

    signals.add('fan-in');
    scoreByModule.set(entry.module, nextScore);
    signalsByModule.set(entry.module, signals);
  }

  for (const entry of dependencies.fanOutTop) {
    const nextScore = (scoreByModule.get(entry.module) ?? 0) + entry.count;
    const signals = signalsByModule.get(entry.module) ?? new Set<string>();

    signals.add('fan-out');
    scoreByModule.set(entry.module, nextScore);
    signalsByModule.set(entry.module, signals);
  }

  const hotspots = Array.from(scoreByModule.entries())
    .map(([module, score]) => ({
      module,
      score,
      signals: Array.from(signalsByModule.get(module) ?? []).sort(),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.module.localeCompare(b.module);
    });

  if (hotspots.length === 0) {
    return createEmptyCoupling();
  }

  return {
    hotspots,
  };
};

export { analyzeCoupling, createEmptyCoupling };