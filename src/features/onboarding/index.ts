import type { Telegraf } from 'telegraf';

import { registerOnboardingAdmin } from './admin';
import { registerOnboardingCommands } from './routes';

export { onboardingScene, ONBOARDING_SCENE_ID } from './scene';
export { submit, approve, reject } from './service';

export function register(bot: Telegraf): void {
  registerOnboardingCommands(bot);
  registerOnboardingAdmin(bot);
}
