import type { Context, MiddlewareFn, Scenes } from 'telegraf';
import type { BaseScene } from 'telegraf/scenes';

import { editOrReply } from './nav';

/**
 * Resolve the previous and next scene in a chain.
 * Used by per-scene `back` / `next` actions so scene order is defined
 * in one place, not hardcoded in every scene file.
 */
export interface SceneChain {
  readonly steps: readonly string[];
  prevOf(current: string): string | null;
  nextOf(current: string): string | null;
}

export function defineChain(steps: readonly string[]): SceneChain {
  const indexByName = new Map<string, number>();
  steps.forEach((s, i) => indexByName.set(s, i));
  return {
    steps,
    prevOf(current) {
      const i = indexByName.get(current);
      if (i === undefined || i === 0) return null;
      return steps[i - 1] ?? null;
    },
    nextOf(current) {
      const i = indexByName.get(current);
      if (i === undefined || i === steps.length - 1) return null;
      return steps[i + 1] ?? null;
    },
  };
}

/** Type alias for the Scene constructor used by feature scenes. */
export type Scene = BaseScene<never>;

/** How long an abandoned wizard stays armed before self-expiring. */
export const SCENE_TTL_SECONDS = 30 * 60;

interface SceneSessionData {
  current?: string;
  expires?: number;
  state?: Record<string, unknown>;
}

type SceneSessionCtx = Context & { session?: { __scenes?: SceneSessionData } };

const START_COMMAND = /^\/start(?:@\w+)?(?:\s|$)/;

/**
 * Scene-session housekeeping that must run BEFORE the stage middleware
 * (compose it right after the session middleware):
 *
 * - /start always escapes an active wizard, so the one universal command is
 *   never swallowed by a scene's text handler;
 * - every update inside a scene refreshes `__scenes.expires`, which telegraf's
 *   SceneContextScene honors natively — abandoned wizards self-expire instead
 *   of trapping the member indefinitely (and across restarts via Redis).
 */
export function sceneSessionGuard(ttlSeconds = SCENE_TTL_SECONDS): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const session = (ctx as SceneSessionCtx).session;
    if (session?.__scenes?.current) {
      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
      if (text && START_COMMAND.test(text)) {
        delete session.__scenes;
      }
    }
    await next();
    const scenes = (ctx as SceneSessionCtx).session?.__scenes;
    if (scenes?.current) {
      scenes.expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    }
  };
}

export interface RegisterCancelOptions {
  /** Exit copy shown when the wizard is abandoned. */
  text: string;
  /** Keyboard to leave the user with (home menu for member wizards). */
  extra?: Parameters<Context['reply']>[1];
  /** callback_data of the inline «Отмена» button; omit for command-only wizards. */
  action?: string;
}

/**
 * Register the wizard exit on a scene: the typed /cancel command and (when
 * `action` is given) the inline cancel button, both leaving the scene with one
 * exit message + keyboard so the member is never stranded without buttons.
 */
export function registerCancel(
  scene: Scenes.BaseScene<Scenes.SceneContext>,
  options: RegisterCancelOptions,
): void {
  const { text, extra, action } = options;
  scene.command('cancel', async (ctx) => {
    ctx.scene.state = {};
    await ctx.scene.leave();
    await ctx.reply(text, extra);
  });
  if (action) {
    scene.action(action, async (ctx) => {
      ctx.scene.state = {};
      await ctx.scene.leave();
      try {
        await ctx.answerCbQuery();
      } catch {
        /* query expired or already answered */
      }
      await editOrReply(ctx, text, extra);
    });
  }
}
