import pinoLib, { type Logger } from 'pino';

import { getConfig } from './config';

const cfg = getConfig();

export const logger: Logger = pinoLib({
  level: cfg.logLevel,
  transport:
    cfg.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});

interface MetricsRegistry {
  counters: Map<string, number>;
  samples: Map<string, number[]>;
}

const registry: MetricsRegistry = {
  counters: new Map(),
  samples: new Map(),
};

const MAX_SAMPLES = 1_000;

export const metrics = {
  incr(name: string, by = 1): void {
    registry.counters.set(name, (registry.counters.get(name) ?? 0) + by);
  },
  get(name: string): number {
    return registry.counters.get(name) ?? 0;
  },
  recordMs(name: string, ms: number): void {
    const arr = registry.samples.get(name) ?? [];
    arr.push(ms);
    if (arr.length > MAX_SAMPLES) arr.splice(0, arr.length - MAX_SAMPLES);
    registry.samples.set(name, arr);
  },
  getSamples(name: string): number[] {
    return [...(registry.samples.get(name) ?? [])];
  },
  snapshot(): { counters: Record<string, number>; samples: Record<string, number[]> } {
    return {
      counters: Object.fromEntries(registry.counters),
      samples: Object.fromEntries(registry.samples),
    };
  },
};

export function resetMetrics(): void {
  registry.counters.clear();
  registry.samples.clear();
}
