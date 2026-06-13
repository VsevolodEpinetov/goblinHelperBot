import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bot } from '../../core/bot';
import { addRole, removeRole, replaceRole } from '../../db/repos/user-roles-mutations';

import {
  getApplicationByUserId,
  insertApplication,
  setApplicationStatus,
  updateApplicationTale,
} from './repo';
import { approve, canSubmit, normalizeTale, reject, submit } from './service';

const h = vi.hoisted(() => {
  process.env.ADMIN_NOTIFICATIONS_CHAT = '-100777';
  const state = {
    applicationRow: undefined as Record<string, unknown> | undefined,
  };
  function connFn(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    for (const m of ['where', 'first', 'select', 'update', 'insert']) {
      builder[m] = () => builder;
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(table === 'applications' ? state.applicationRow : undefined).then(
        onFulfilled,
        onRejected,
      );
    return builder;
  }
  const conn = Object.assign(connFn, {
    transaction: (fn: (trx: unknown) => unknown): Promise<unknown> => Promise.resolve(fn(conn)),
  });
  return { state, conn };
});

vi.mock('../../db/client', () => ({ db: h.conn }));
vi.mock('../../core/bot', () => ({ bot: { telegram: { sendMessage: vi.fn() } } }));
vi.mock('../subscriptions', () => ({ archiveKeyboard: () => ({}) }));
vi.mock('../../db/repos/user-roles-mutations', () => ({
  addRole: vi.fn(),
  removeRole: vi.fn(),
  replaceRole: vi.fn(),
}));
vi.mock('./repo', () => ({
  getApplicationByUserId: vi.fn(),
  insertApplication: vi.fn(),
  setApplicationStatus: vi.fn(),
  updateApplicationTale: vi.fn(),
}));

const sendMessage = vi.mocked(bot.telegram.sendMessage);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const input = {
  userId: 7,
  username: 'newbie',
  firstName: 'N',
  lastName: null,
  tale: 'я гоблин из чащи',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.state.applicationRow = undefined;
  vi.mocked(getApplicationByUserId).mockResolvedValue(undefined);
  vi.mocked(insertApplication).mockResolvedValue(9);
});

describe('onboarding.service.canSubmit', () => {
  it('true when no existing application', () => {
    expect(canSubmit(undefined)).toBe(true);
  });

  it('false when an application is already pending', () => {
    expect(canSubmit({ status: 'pending' } as never)).toBe(false);
  });

  it('false when already approved', () => {
    expect(canSubmit({ status: 'approved' } as never)).toBe(false);
  });

  it('true when previously rejected (allow re-apply)', () => {
    expect(canSubmit({ status: 'rejected' } as never)).toBe(true);
  });
});

describe('onboarding.service.normalizeTale', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTale('  я гоблин из чащи  ')).toBe('я гоблин из чащи');
  });

  it('returns null for an empty string', () => {
    expect(normalizeTale('')).toBeNull();
  });

  it('returns null for whitespace-only input', () => {
    expect(normalizeTale('   \n  ')).toBeNull();
  });

  it('returns null for undefined/null', () => {
    expect(normalizeTale(undefined)).toBeNull();
    expect(normalizeTale(null)).toBeNull();
  });

  it('keeps internal newlines and content intact', () => {
    expect(normalizeTale('строка один\nстрока два')).toBe('строка один\nстрока два');
  });
});

describe('onboarding.service.submit', () => {
  it('inserts a fresh application, adds the pending role and announces it', async () => {
    const result = await submit(input);
    expect(result).toEqual({ status: 'submitted', applicationId: 9 });
    expect(insertApplication).toHaveBeenCalledWith(expect.anything(), input);
    expect(addRole).toHaveBeenCalledWith(expect.anything(), 7, 'pending');
    expect(removeRole).not.toHaveBeenCalled();
    await flush();
    expect(sendMessage).toHaveBeenCalledWith('-100777', expect.any(String), expect.anything());
  });

  it('returns already_pending without touching roles', async () => {
    vi.mocked(getApplicationByUserId).mockResolvedValue({ id: 3, status: 'pending' } as never);
    const result = await submit(input);
    expect(result).toEqual({ status: 'already_pending', applicationId: 3 });
    expect(addRole).not.toHaveBeenCalled();
    expect(insertApplication).not.toHaveBeenCalled();
    await flush();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('returns already_approved without touching roles', async () => {
    vi.mocked(getApplicationByUserId).mockResolvedValue({ id: 3, status: 'approved' } as never);
    const result = await submit(input);
    expect(result).toEqual({ status: 'already_approved', applicationId: 3 });
    expect(addRole).not.toHaveBeenCalled();
    expect(setApplicationStatus).not.toHaveBeenCalled();
  });

  it('re-applies after a rejection: flips status, refreshes tale, swaps roles', async () => {
    vi.mocked(getApplicationByUserId).mockResolvedValue({ id: 3, status: 'rejected' } as never);
    const result = await submit(input);
    expect(result).toEqual({ status: 'submitted', applicationId: 3 });
    expect(setApplicationStatus).toHaveBeenCalledWith(expect.anything(), 3, 'pending');
    expect(updateApplicationTale).toHaveBeenCalledWith(expect.anything(), 3, input.tale);
    expect(removeRole).toHaveBeenCalledWith(expect.anything(), 7, 'rejected');
    expect(addRole).toHaveBeenCalledWith(expect.anything(), 7, 'pending');
    expect(insertApplication).not.toHaveBeenCalled();
  });
});

describe('onboarding.service.approve', () => {
  it('approves a pending application and moves pending → preapproved', async () => {
    h.state.applicationRow = { id: 5, status: 'pending', user_id: 7 };
    const result = await approve(5, 900);
    expect(result).toBe('approved');
    expect(setApplicationStatus).toHaveBeenCalledWith(expect.anything(), 5, 'approved');
    expect(replaceRole).toHaveBeenCalledWith(expect.anything(), 7, 'pending', 'preapproved');
    await flush();
    expect(sendMessage).toHaveBeenCalledWith(7, expect.any(String), expect.anything());
  });

  it('returns not_pending on a second verdict (double-tap guard)', async () => {
    h.state.applicationRow = { id: 5, status: 'approved', user_id: 7 };
    const result = await approve(5, 900);
    expect(result).toBe('not_pending');
    expect(setApplicationStatus).not.toHaveBeenCalled();
    expect(replaceRole).not.toHaveBeenCalled();
    await flush();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('cannot approve an already-rejected application', async () => {
    h.state.applicationRow = { id: 5, status: 'rejected', user_id: 7 };
    expect(await approve(5, 900)).toBe('not_pending');
    expect(replaceRole).not.toHaveBeenCalled();
  });

  it('returns not_found for a missing application', async () => {
    h.state.applicationRow = undefined;
    expect(await approve(5, 900)).toBe('not_found');
    expect(setApplicationStatus).not.toHaveBeenCalled();
  });
});

describe('onboarding.service.reject', () => {
  it('rejects a pending application, moves pending → rejected and DMs the user', async () => {
    h.state.applicationRow = { id: 5, status: 'pending', user_id: 7 };
    const result = await reject(5, 900);
    expect(result).toBe('rejected');
    expect(setApplicationStatus).toHaveBeenCalledWith(expect.anything(), 5, 'rejected');
    expect(replaceRole).toHaveBeenCalledWith(expect.anything(), 7, 'pending', 'rejected');
    await flush();
    expect(sendMessage).toHaveBeenCalledWith(7, expect.any(String));
  });

  it('returns not_pending when the application was already decided', async () => {
    h.state.applicationRow = { id: 5, status: 'rejected', user_id: 7 };
    expect(await reject(5, 900)).toBe('not_pending');
    expect(setApplicationStatus).not.toHaveBeenCalled();
    expect(replaceRole).not.toHaveBeenCalled();
  });

  it('returns not_found for a missing application', async () => {
    h.state.applicationRow = undefined;
    expect(await reject(5, 900)).toBe('not_found');
  });
});
