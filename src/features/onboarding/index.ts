import { Markup } from 'telegraf';
import type { Telegraf } from 'telegraf';

import { registerFallbackKeyboards } from '../../core/nav';

import { registerOnboardingAdmin } from './admin';
import { homeRow, startMenuForNewbie } from './menus';
import { registerOnboardingCommands } from './routes';

export { onboardingScene, ONBOARDING_SCENE_ID } from './scene';
export { submit, approve, reject } from './service';

export function register(bot: Telegraf): void {
  // Hand core's permission-denial and error replies their recovery keyboards —
  // core can't import feature menus itself.
  registerFallbackKeyboards({
    gate: () => startMenuForNewbie(),
    home: () => Markup.inlineKeyboard([homeRow()]),
  });
  registerOnboardingCommands(bot);
  registerOnboardingAdmin(bot);
}
