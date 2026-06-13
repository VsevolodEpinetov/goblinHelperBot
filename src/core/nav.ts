import type { Context } from 'telegraf';

type ReplyExtra = Parameters<Context['reply']>[1];

/**
 * Fallback keyboards for replies issued from core (permission denials, error
 * middleware). Core can't import feature menus — the onboarding feature
 * registers its keyboards here at startup instead, keeping the dependency
 * pointing features → core.
 */
const fallbackKeyboards: {
  /** The newbie start menu (about / apply) — recovery surface for outsiders. */
  gate?: () => ReplyExtra;
  /** A home-button row — recovery surface for approved members. */
  home?: () => ReplyExtra;
} = {};

export function registerFallbackKeyboards(factories: {
  gate: () => ReplyExtra;
  home: () => ReplyExtra;
}): void {
  fallbackKeyboards.gate = factories.gate;
  fallbackKeyboards.home = factories.home;
}

export function gateKeyboard(): ReplyExtra | undefined {
  return fallbackKeyboards.gate?.();
}

export function homeKeyboard(): ReplyExtra | undefined {
  return fallbackKeyboards.home?.();
}

function isNotModifiedError(err: unknown): boolean {
  return Boolean(
    (err as { description?: string }).description?.includes('message is not modified'),
  );
}

/**
 * Render a menu screen in place when we're handling a callback (edit the message
 * the button lives on), otherwise post a fresh message. This keeps a member's
 * navigation on a single evolving message instead of stacking orphaned screens.
 *
 * A double-tap re-rendering identical content («message is not modified») is
 * swallowed silently — the screen is already correct. Other edit failures —
 * e.g. the current message is a photo/media message (can't text-edit) or is
 * too old to edit — fall back to ctx.reply.
 */
export async function editOrReply(ctx: Context, text: string, extra?: ReplyExtra): Promise<void> {
  const cq = ctx.callbackQuery;
  if (cq && 'message' in cq && cq.message) {
    try {
      await ctx.editMessageText(text, extra as Parameters<Context['editMessageText']>[1]);
      return;
    } catch (err) {
      if (isNotModifiedError(err)) return;
      // Fall through to a fresh message.
    }
  }
  await ctx.reply(text, extra);
}

/**
 * Answer the callback query first (clearing the spinner even if rendering
 * fails), then render via editOrReply. Use this in callback handlers that
 * don't need a toast — it makes double-taps a harmless no-op.
 */
export async function answerThenEdit(
  ctx: Context,
  text: string,
  extra?: ReplyExtra,
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCbQuery();
    } catch {
      /* query expired or already answered */
    }
  }
  await editOrReply(ctx, text, extra);
}
