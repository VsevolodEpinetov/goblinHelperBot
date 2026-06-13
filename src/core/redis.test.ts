import { afterEach, describe, expect, it, vi } from 'vitest';

const { fakeClient, rawGet, rawSet, rawDel, createClientMock } = vi.hoisted(() => {
  const rawGet = vi.fn();
  const rawSet = vi.fn();
  const rawDel = vi.fn();
  const fakeClient = {
    on: vi.fn(),
    get: rawGet,
    set: rawSet,
    del: rawDel,
    connect: vi.fn(),
    quit: vi.fn(),
    isOpen: false,
  };
  return {
    fakeClient,
    rawGet,
    rawSet,
    rawDel,
    createClientMock: vi.fn((_opts?: unknown) => fakeClient),
  };
});

vi.mock('redis', () => ({ createClient: createClientMock }));
vi.mock('./config', () => ({
  getConfig: () => ({
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: undefined,
    logLevel: 'fatal',
    nodeEnv: 'test',
  }),
}));

import { connectRedis, redis } from './redis';

describe('redis client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates the client with a capped reconnect strategy and bounded command queue', () => {
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        commandsQueueMaxLength: 1000,
        socket: expect.objectContaining({ reconnectStrategy: expect.any(Function) }),
      }),
    );
    const opts = createClientMock.mock.calls[0]?.[0] as unknown as {
      socket: { reconnectStrategy: (retries: number) => number };
    };
    expect(opts.socket.reconnectStrategy(1)).toBe(200);
    expect(opts.socket.reconnectStrategy(1000)).toBe(5000);
  });

  it('passes through values when the command succeeds', async () => {
    rawGet.mockResolvedValueOnce('value');
    await expect(redis.get('k')).resolves.toBe('value');
  });

  it('degrades get to null when the command fails', async () => {
    rawGet.mockRejectedValueOnce(new Error('queue is full'));
    await expect(redis.get('k')).resolves.toBeNull();
  });

  it('degrades get to null when the command stalls past the timeout', async () => {
    vi.useFakeTimers();
    rawGet.mockImplementationOnce(() => new Promise(() => undefined));
    const pending = redis.get('k');
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toBeNull();
  });

  it('degrades set and del on failure', async () => {
    rawSet.mockRejectedValueOnce(new Error('down'));
    rawDel.mockRejectedValueOnce(new Error('down'));
    await expect(redis.set('k', 'v')).resolves.toBeNull();
    await expect(redis.del('k')).resolves.toBe(0);
  });

  it('connectRedis connects only when the client is not open', async () => {
    fakeClient.isOpen = false;
    await connectRedis();
    expect(fakeClient.connect).toHaveBeenCalledTimes(1);
    fakeClient.isOpen = true;
    await connectRedis();
    expect(fakeClient.connect).toHaveBeenCalledTimes(1);
  });
});
