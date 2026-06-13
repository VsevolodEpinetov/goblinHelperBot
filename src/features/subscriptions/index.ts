import type { Telegraf } from 'telegraf';

import { registerSubscriptionActions } from './actions';
import { registerSubscriptionCommands } from './routes';

export function register(bot: Telegraf): void {
  registerSubscriptionCommands(bot);
  registerSubscriptionActions();
}

export { decidePurchaseAction } from './service';
export { getSubscriptionStatus, listUserSubscriptions } from './repo';
export { archiveKeyboard } from './menus';
