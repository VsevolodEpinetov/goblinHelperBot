import { describe, expect, it, vi } from 'vitest';

import { requireDM, requireGroup, requireRoles } from './permissions';

function makeCtx(state: { roles?: string[] }, chat?: { type: string; id: number }): unknown {
  return {
    state,
    chat,
    answerCbQuery: vi.fn(),
    reply: vi.fn(),
  };
}

describe('permissions', () => {
  describe('requireRoles', () => {
    it('allows when the user has any of the required roles', async () => {
      const mw = requireRoles('admin');
      const next = vi.fn();
      await mw(makeCtx({ roles: ['admin'] }) as never, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects when none of the roles match', async () => {
      const mw = requireRoles('admin', 'super');
      const next = vi.fn();
      await mw(makeCtx({ roles: ['plus'] }) as never, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when roles is undefined', async () => {
      const mw = requireRoles('admin');
      const next = vi.fn();
      await mw(makeCtx({}) as never, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireDM', () => {
    it('passes when chat is private', async () => {
      const mw = requireDM();
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'private', id: 1 }) as never, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects when chat is a group', async () => {
      const mw = requireDM();
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'group', id: 1 }) as never, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireGroup', () => {
    it('passes when chat id matches', async () => {
      const mw = requireGroup(-100);
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'supergroup', id: -100 }) as never, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects when chat id does not match', async () => {
      const mw = requireGroup(-100);
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'group', id: -999 }) as never, next);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
