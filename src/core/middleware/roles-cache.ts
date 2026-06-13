import { LRUCache } from 'lru-cache';

import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';

const TTL_MS = 30_000;

const cache = new LRUCache<number, string[]>({ max: 10_000, ttl: TTL_MS });

export function createRolesCache(
  fetchRoles: (userId: number) => Promise<string[]>,
  store: LRUCache<number, string[]> = cache,
): (userId: number) => Promise<string[]> {
  return async (userId) => {
    const hit = store.get(userId);
    if (hit) return hit;
    const roles = await fetchRoles(userId);
    store.set(userId, roles);
    return roles;
  };
}

export const getRolesCached: (userId: number) => Promise<string[]> = createRolesCache((id) =>
  getRolesForUser(db, id),
);

export async function isBannedCached(userId: number): Promise<boolean> {
  const roles = await getRolesCached(userId);
  return roles.includes('banned') || roles.includes('selfBanned');
}

export function invalidateRolesCache(userId: number): void {
  cache.delete(userId);
}
