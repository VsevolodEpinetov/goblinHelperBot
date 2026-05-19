import type { BaseScene } from 'telegraf/scenes';

/**
 * Resolve the previous and next scene in a chain.
 * Used by per-scene `back` / `next` actions so scene order is defined
 * in one place, not hardcoded in every scene file.
 */
export interface SceneChain {
  readonly steps: readonly string[];
  prevOf(current: string): string | null;
  nextOf(current: string): string | null;
}

export function defineChain(steps: readonly string[]): SceneChain {
  const indexByName = new Map<string, number>();
  steps.forEach((s, i) => indexByName.set(s, i));
  return {
    steps,
    prevOf(current) {
      const i = indexByName.get(current);
      if (i === undefined || i === 0) return null;
      return steps[i - 1] ?? null;
    },
    nextOf(current) {
      const i = indexByName.get(current);
      if (i === undefined || i === steps.length - 1) return null;
      return steps[i + 1] ?? null;
    },
  };
}

/** Type alias for the Scene constructor used by feature scenes. */
export type Scene = BaseScene<never>;
