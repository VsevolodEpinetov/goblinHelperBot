import { describe, expect, it, vi } from 'vitest';

import { createRbacMiddleware } from './rbac';

describe('rbacMiddleware', () => {
  it('populates ctx.state.roles from the role getter', async () => {
    const getRoles = vi.fn().mockResolvedValue(['admin', 'plus']);
    const mw = createRbacMiddleware(getRoles);
    const ctx: { from?: { id: number }; state: { roles?: string[] } } = {
      from: { id: 1 },
      state: {},
    };
    const next = vi.fn();
    await mw(ctx as never, next);
    expect(ctx.state.roles).toEqual(['admin', 'plus']);
    expect(next).toHaveBeenCalled();
  });

  it('sets roles=[] when from is missing', async () => {
    const getRoles = vi.fn();
    const mw = createRbacMiddleware(getRoles);
    const ctx: { from?: { id: number }; state: { roles?: string[] } } = { state: {} };
    const next = vi.fn();
    await mw(ctx as never, next);
    expect(ctx.state.roles).toEqual([]);
    expect(getRoles).not.toHaveBeenCalled();
  });

  it('defaults to [] on getRoles failure (continues chain)', async () => {
    const getRoles = vi.fn().mockRejectedValue(new Error('DB error'));
    const mw = createRbacMiddleware(getRoles);
    const ctx: { from?: { id: number }; state: { roles?: string[] } } = {
      from: { id: 1 },
      state: {},
    };
    const next = vi.fn();
    await mw(ctx as never, next);
    expect(ctx.state.roles).toEqual([]);
    expect(next).toHaveBeenCalled();
  });
});
