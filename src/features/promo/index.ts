import type { Telegraf } from 'telegraf';

import { register as registerRoutes } from './routes';
export { promoCallback } from './schemas';

export function register(bot: Telegraf): void {
  registerRoutes(bot);
}
