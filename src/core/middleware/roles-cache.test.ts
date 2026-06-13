import { LRUCache } from 'lru-cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRolesForUser } from '../../db/repos/user-roles';

import {
  createRolesCache,
  getRolesCached,
  invalidateRolesCache,
  isBannedCached,
} from './roles-cache';

vi.mock('../../db/client', () => ({ db: {} }));
vi.mock('../../db/repos/user-roles', () => ({ getRolesForUser: vi.fn() }));

const getRolesMock = vi.mocked(getRolesForUser);

describe('roles-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches once and serves repeat lookups from cache', async () => {
    getRolesMock.mockResolvedValue(['member']);
    await expect(getRolesCached(101)).resolves.toEqual(['member']);
    await expect(getRolesCached(101)).resolves.toEqual(['member']);
    expect(getRolesMock).toHaveBeenCalledTimes(1);
  });

  it('invalidateRolesCache forces a refetch', async () => {
    getRolesMock.mockResolvedValue(['member']);
    await getRolesCached(102);
    invalidateRolesCache(102);
    await getRolesCached(102);
    expect(getRolesMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache failed lookups', async () => {
    getRolesMock.mockRejectedValueOnce(new Error('DB blip'));
    getRolesMock.mockResolvedValueOnce(['member']);
    await expect(getRolesCached(103)).rejects.toThrow('DB blip');
    await expect(getRolesCached(103)).resolves.toEqual(['member']);
  });

  it('isBannedCached detects banned and selfBanned roles', async () => {
    getRolesMock.mockResolvedValueOnce(['banned']);
    await expect(isBannedCached(104)).resolves.toBe(true);
    getRolesMock.mockResolvedValueOnce(['selfBanned']);
    await expect(isBannedCached(105)).resolves.toBe(true);
    getRolesMock.mockResolvedValueOnce(['member']);
    await expect(isBannedCached(106)).resolves.toBe(false);
  });

  it('expires entries after the TTL', async () => {
    const fetch = vi.fn().mockResolvedValue(['member']);
    const cached = createRolesCache(fetch, new LRUCache({ max: 10, ttl: 20 }));
    await cached(1);
    await cached(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await cached(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
