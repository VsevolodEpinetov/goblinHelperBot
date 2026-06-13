import type { Telegraf } from 'telegraf';

import { registerAdminRoutes } from './admin-routes';
import { registerUserRoutes } from './routes';

export function register(bot: Telegraf): void {
  registerUserRoutes(bot);
  registerAdminRoutes(bot);
}
