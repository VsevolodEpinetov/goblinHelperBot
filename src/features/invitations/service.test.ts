import { describe, expect, it, vi } from 'vitest';

import { makeService, type TelegramClient } from './service';

describe('invitations.service.getOrCreateInvitationLink', () => {
  function buildClient(): TelegramClient & { calls: { create: number; revoke: number } } {
    const calls = { create: 0, revoke: 0 };
    return {
      calls,
      async createChatInviteLink(_chatId, opts) {
        calls.create += 1;
        return {
          invite_link: `https://t.me/+abc${calls.create}`,
          creator: { id: 1 },
          creates_join_request: opts.createsJoinRequest ?? false,
          is_primary: false,
          is_revoked: false,
        };
      },
      async revokeChatInviteLink(_chatId, inviteLink) {
        calls.revoke += 1;
        return { invite_link: inviteLink, is_revoked: true } as never;
      },
    };
  }

  it('creates a fresh link when none exists', async () => {
    const client = buildClient();
    const monthChatId = vi.fn().mockResolvedValue('-100123');
    const findActive = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockResolvedValue(42);

    const svc = makeService({
      client,
      getMonthChatId: monthChatId,
      findActiveLink: findActive,
      insertInvitation: insert,
    });
    const result = await svc.getOrCreateInvitationLink({
      userId: 1,
      period: '2026_05',
      type: 'regular',
    });

    expect(result.status).toBe('created');
    if (result.status === 'created') {
      expect(result.link).toMatch(/^https:\/\/t\.me\/\+abc/);
    }
    expect(client.calls.create).toBe(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('returns an existing active link without creating a new one', async () => {
    const client = buildClient();
    const findActive = vi.fn().mockResolvedValue({
      id: 99,
      telegramInviteLink: 'https://t.me/+existing',
      groupPeriod: '2026_05',
      groupType: 'regular',
    });
    const svc = makeService({
      client,
      getMonthChatId: vi.fn().mockResolvedValue('-100'),
      findActiveLink: findActive,
      insertInvitation: vi.fn(),
    });
    const result = await svc.getOrCreateInvitationLink({
      userId: 1,
      period: '2026_05',
      type: 'regular',
    });
    expect(result.status).toBe('existing');
    if (result.status === 'existing') {
      expect(result.link).toBe('https://t.me/+existing');
    }
    expect(client.calls.create).toBe(0);
  });

  it('reports "no_chat" when the period+type has no configured chat', async () => {
    const client = buildClient();
    const svc = makeService({
      client,
      getMonthChatId: vi.fn().mockResolvedValue(null),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
    });
    const result = await svc.getOrCreateInvitationLink({
      userId: 1,
      period: '2026_05',
      type: 'regular',
    });
    expect(result.status).toBe('no_chat');
  });

  it('createMainGroupLink mints a one-time join-request link to the main group', async () => {
    const client = buildClient();
    const svc = makeService({
      client,
      getMonthChatId: vi.fn(),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
      mainGroupId: () => '-100999',
    });
    const result = await svc.createMainGroupLink(7);
    expect(result.status).toBe('created');
    if (result.status === 'created') {
      expect(result.link).toMatch(/^https:\/\/t\.me\/\+abc/);
    }
    expect(client.calls.create).toBe(1);
  });

  it('createMainGroupLink reports no_main_group when MAIN_GROUP_ID is unset', async () => {
    const client = buildClient();
    const svc = makeService({
      client,
      getMonthChatId: vi.fn(),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
      mainGroupId: () => undefined,
    });
    expect((await svc.createMainGroupLink(7)).status).toBe('no_main_group');
  });

  it('never combines createsJoinRequest with memberLimit (Telegram rejects that with 400)', async () => {
    const seen: Array<{ createsJoinRequest?: boolean; memberLimit?: number }> = [];
    const client: TelegramClient = {
      async createChatInviteLink(_chatId, opts) {
        seen.push(opts);
        return {
          invite_link: 'https://t.me/+shape',
          creator: { id: 1 },
          creates_join_request: opts.createsJoinRequest ?? false,
          is_primary: false,
          is_revoked: false,
        };
      },
      async revokeChatInviteLink() {
        return {};
      },
    };
    const svc = makeService({
      client,
      getMonthChatId: vi.fn().mockResolvedValue('-100123'),
      findActiveLink: vi.fn().mockResolvedValue(undefined),
      insertInvitation: vi.fn().mockResolvedValue(1),
      mainGroupId: () => '-100999',
    });
    await svc.getOrCreateInvitationLink({ userId: 1, period: '2026_05', type: 'regular' });
    await svc.createMainGroupLink(1);
    expect(seen).toHaveLength(2);
    for (const opts of seen) {
      expect(opts.createsJoinRequest).toBe(true);
      expect(opts.memberLimit).toBeUndefined();
    }
  });

  it('revokeInvitationLink passes the URL, NOT the period (the legacy bug)', async () => {
    const client = buildClient();
    const svc = makeService({
      client,
      getMonthChatId: vi.fn().mockResolvedValue('-100123'),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
    });
    await svc.revokeInvitationLink({
      chatId: '-100123',
      telegramInviteLink: 'https://t.me/+to-revoke',
    });
    expect(client.calls.revoke).toBe(1);
  });

  it('revokeInvitationLink swallows API errors (best-effort)', async () => {
    const failingClient: TelegramClient = {
      async createChatInviteLink() {
        throw new Error('unused');
      },
      async revokeChatInviteLink() {
        throw new Error('Telegram API down');
      },
    };
    const svc = makeService({
      client: failingClient,
      getMonthChatId: vi.fn(),
      findActiveLink: vi.fn(),
      insertInvitation: vi.fn(),
    });
    await expect(
      svc.revokeInvitationLink({ chatId: '-100', telegramInviteLink: 'https://x' }),
    ).resolves.toBe(false);
  });
});
