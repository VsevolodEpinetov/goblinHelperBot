import type { Telegraf } from 'telegraf';

import { register as registerRoutes } from './routes';

export { grantXp, grantXpInTrx, getProfile } from './service';
export {
  dispatchNotifications,
  sendXpGainNotification,
  sendLevelUpNotification,
} from './notifications';
export { getUserLevel, getLeaderboard } from './repo';

export function register(bot: Telegraf): void {
  registerRoutes(bot);
}
