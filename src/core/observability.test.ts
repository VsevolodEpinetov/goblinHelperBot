import { afterEach, describe, expect, it } from 'vitest';

import { metrics, resetMetrics } from './observability';

describe('observability metrics', () => {
  afterEach(() => resetMetrics());

  it('increments named counters', () => {
    metrics.incr('payments.success');
    metrics.incr('payments.success');
    metrics.incr('payments.failure');

    expect(metrics.get('payments.success')).toBe(2);
    expect(metrics.get('payments.failure')).toBe(1);
    expect(metrics.get('does.not.exist')).toBe(0);
  });

  it('records timer values', () => {
    metrics.recordMs('handler.latency', 50);
    metrics.recordMs('handler.latency', 100);
    const samples = metrics.getSamples('handler.latency');
    expect(samples).toEqual([50, 100]);
  });

  it('caps samples at the most recent 1000', () => {
    for (let i = 1; i <= 1010; i++) metrics.recordMs('handler.latency', i);
    const samples = metrics.getSamples('handler.latency');
    expect(samples).toHaveLength(1000);
    expect(samples[0]).toBe(11);
    expect(samples[999]).toBe(1010);
  });

  it('resets on resetMetrics()', () => {
    metrics.incr('foo');
    resetMetrics();
    expect(metrics.get('foo')).toBe(0);
  });

  it('snapshot returns counters + samples object', () => {
    metrics.incr('a');
    metrics.recordMs('b', 10);
    const snap = metrics.snapshot();
    expect(snap.counters.a).toBe(1);
    expect(snap.samples.b).toEqual([10]);
  });
});
