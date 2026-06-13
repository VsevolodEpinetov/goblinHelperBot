import { beforeEach, describe, expect, it, vi } from 'vitest';

import { service as invitationsService } from '../invitations/service';
import { listUserSubscriptions } from '../subscriptions/repo';

import { deliverAccessKeys } from './invite-delivery';

const h = vi.hoisted(() => {
  process.env.ADMIN_NOTIFICATIONS_CHAT = '-100777';
  const state = {
    userRow: { username: 'buyer' } as { username: string | null } | undefined,
  };
  function connFn(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    for (const m of ['where', 'first', 'select', 'orderBy']) {
      builder[m] = () => builder;
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(table === 'users' ? state.userRow : undefined).then(onFulfilled, onRejected);
    return builder;
  }
  return { state, conn: connFn };
});

vi.mock('../../db/client', () => ({ db: h.conn }));
vi.mock('../invitations/service', () => ({
  service: {
    getOrCreateInvitationLink: vi.fn(),
    createMainGroupLink: vi.fn(),
    revokeInvitationLink: vi.fn(),
  },
}));
vi.mock('../subscriptions/repo', () => ({ listUserSubscriptions: vi.fn() }));

const getOrCreate = vi.mocked(invitationsService.getOrCreateInvitationLink);
const createMain = vi.mocked(invitationsService.createMainGroupLink);
const listSubs = vi.mocked(listUserSubscriptions);

function makeTelegram() {
  return { sendMessage: vi.fn().mockResolvedValue(true) };
}

interface KeyboardButton {
  url?: string;
  callback_data?: string;
}

function keyboardButtons(extra: unknown): KeyboardButton[] {
  const kb =
    (extra as { reply_markup?: { inline_keyboard?: KeyboardButton[][] } } | undefined)?.reply_markup
      ?.inline_keyboard ?? [];
  return kb.flat();
}

function urls(extra: unknown): string[] {
  return keyboardButtons(extra)
    .map((b) => b.url)
    .filter((u): u is string => !!u);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.userRow = { username: 'buyer' };
  getOrCreate.mockResolvedValue({ status: 'created', link: 'https://t.me/+arc', rowId: 1 });
  createMain.mockResolvedValue({ status: 'created', link: 'https://t.me/+main' });
  listSubs.mockResolvedValue([{ period: '2026_06', tier: 'regular' }]);
});

describe('payments.invite-delivery.deliverAccessKeys', () => {
  it('sends both the main-group key and the archive key on the first paid period', async () => {
    const telegram = makeTelegram();
    await deliverAccessKeys({
      telegram: telegram as never,
      userId: 7,
      period: '2026_06',
      type: 'regular',
    });

    expect(createMain).toHaveBeenCalledWith(7);
    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    const [to, , extra] = telegram.sendMessage.mock.calls[0]!;
    expect(to).toBe(7);
    expect(urls(extra)).toEqual(['https://t.me/+main', 'https://t.me/+arc']);
  });

  it('sends only the archive key on a later paid period', async () => {
    listSubs.mockResolvedValue([
      { period: '2026_05', tier: 'regular' },
      { period: '2026_06', tier: 'regular' },
    ]);
    const telegram = makeTelegram();
    await deliverAccessKeys({
      telegram: telegram as never,
      userId: 7,
      period: '2026_06',
      type: 'regular',
    });

    expect(createMain).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    const [to, , extra] = telegram.sendMessage.mock.calls[0]!;
    expect(to).toBe(7);
    expect(urls(extra)).toEqual(['https://t.me/+arc']);
  });

  it('counts an upgraded single period as the first paid period (re-mints the main key)', async () => {
    listSubs.mockResolvedValue([
      { period: '2026_06', tier: 'regular' },
      { period: '2026_06', tier: 'plus' },
    ]);
    const telegram = makeTelegram();
    await deliverAccessKeys({
      telegram: telegram as never,
      userId: 7,
      period: '2026_06',
      type: 'plus',
    });

    expect(createMain).toHaveBeenCalledWith(7);
    expect(urls(telegram.sendMessage.mock.calls[0]![2])).toContain('https://t.me/+main');
  });

  it('falls back to the archive-only message when MAIN_GROUP_ID is unset', async () => {
    createMain.mockResolvedValue({ status: 'no_main_group' });
    const telegram = makeTelegram();
    await deliverAccessKeys({
      telegram: telegram as never,
      userId: 7,
      period: '2026_06',
      type: 'regular',
    });

    expect(telegram.sendMessage).toHaveBeenCalledTimes(1);
    expect(urls(telegram.sendMessage.mock.calls[0]![2])).toEqual(['https://t.me/+arc']);
  });

  it('on no_chat DMs the buyer and alerts the admin chat with period/type/user', async () => {
    getOrCreate.mockResolvedValue({ status: 'no_chat' });
    const telegram = makeTelegram();
    await deliverAccessKeys({
      telegram: telegram as never,
      userId: 7,
      period: '2026_06',
      type: 'regular',
    });

    expect(createMain).not.toHaveBeenCalled();
    expect(telegram.sendMessage).toHaveBeenCalledTimes(2);

    const [buyerTo, , buyerExtra] = telegram.sendMessage.mock.calls[0]!;
    expect(buyerTo).toBe(7);
    expect(urls(buyerExtra)).toEqual([]);

    const [adminTo, adminText] = telegram.sendMessage.mock.calls[1]!;
    expect(adminTo).toBe('-100777');
    expect(adminText).toContain('2026_06');
    expect(adminText).toContain('regular');
    expect(adminText).toContain('@buyer');
  });

  it('contains delivery errors: DMs the buyer a self-service button and alerts admins', async () => {
    getOrCreate.mockRejectedValue(new Error('Telegram 500'));
    const telegram = makeTelegram();
    await expect(
      deliverAccessKeys({
        telegram: telegram as never,
        userId: 7,
        period: '2026_06',
        type: 'regular',
      }),
    ).resolves.toBeUndefined();

    expect(telegram.sendMessage).toHaveBeenCalledTimes(2);

    const [buyerTo, , buyerExtra] = telegram.sendMessage.mock.calls[0]!;
    expect(buyerTo).toBe(7);
    const callbacks = keyboardButtons(buyerExtra).filter((b) => b.callback_data);
    expect(callbacks.length).toBeGreaterThan(0);

    const [adminTo, adminText] = telegram.sendMessage.mock.calls[1]!;
    expect(adminTo).toBe('-100777');
    expect(adminText).toContain('Telegram 500');
    expect(adminText).toContain('2026_06');
  });

  it('still alerts admins when even the buyer DM fails', async () => {
    getOrCreate.mockRejectedValue(new Error('Telegram 500'));
    const telegram = makeTelegram();
    telegram.sendMessage.mockRejectedValueOnce(new Error('blocked'));
    await expect(
      deliverAccessKeys({
        telegram: telegram as never,
        userId: 7,
        period: '2026_06',
        type: 'regular',
      }),
    ).resolves.toBeUndefined();

    expect(telegram.sendMessage).toHaveBeenCalledTimes(2);
    expect(telegram.sendMessage.mock.calls[1]![0]).toBe('-100777');
  });
});
