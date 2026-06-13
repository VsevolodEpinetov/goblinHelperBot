import { describe, expect, it, vi } from 'vitest';

import { registerFallbackKeyboards } from './nav';
import {
  hasAdminRank,
  requireAdmin,
  requireApprovedMember,
  requireDM,
  requireGroup,
  requireRoles,
} from './permissions';

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

  describe('requireApprovedMember', () => {
    it('allows approved members through', async () => {
      const mw = requireApprovedMember();
      const next = vi.fn();
      await mw(makeCtx({ roles: ['preapproved'] }, { type: 'private', id: 1 }) as never, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects outsiders and replies with the onboarding pitch + gate keyboard in DM', async () => {
      const gateKb = { reply_markup: { inline_keyboard: [] } };
      registerFallbackKeyboards({ gate: () => gateKb, home: () => undefined });
      const mw = requireApprovedMember();
      const next = vi.fn();
      const ctx = makeCtx({ roles: ['pending'] }, { type: 'private', id: 1 }) as {
        reply: ReturnType<typeof vi.fn>;
      };
      await mw(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('обряд допуска'), gateKb);
    });

    it('rejects silently outside private chats', async () => {
      const mw = requireApprovedMember();
      const next = vi.fn();
      const ctx = makeCtx({ roles: [] }, { type: 'supergroup', id: -100 }) as {
        reply: ReturnType<typeof vi.fn>;
      };
      await mw(ctx as never, next);
      expect(next).not.toHaveBeenCalled();
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  describe('hasAdminRank / requireAdmin', () => {
    it('recognizes every admin rank', () => {
      expect(hasAdminRank(['admin'])).toBe(true);
      expect(hasAdminRank(['adminPlus'])).toBe(true);
      expect(hasAdminRank(['super'])).toBe(true);
      expect(hasAdminRank(['preapproved'])).toBe(false);
      expect(hasAdminRank([])).toBe(false);
    });

    it('requireAdmin only lets admin ranks through', async () => {
      const next = vi.fn();
      await requireAdmin()(makeCtx({ roles: ['adminPlus'] }) as never, next);
      expect(next).toHaveBeenCalled();
      const denied = vi.fn();
      await requireAdmin()(makeCtx({ roles: ['preapproved'] }) as never, denied);
      expect(denied).not.toHaveBeenCalled();
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
