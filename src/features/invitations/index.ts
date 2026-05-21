import type { Telegraf } from 'telegraf';

import { registerInvitationActions } from './actions';
import { registerInvitationHandlers } from './handlers';
import { registerInvitationCommands } from './routes';

export { service as invitationService } from './service';
export { getLinkButton, getLinkInline } from './menus';
export { invitationsCallback } from './schemas';

export function register(bot: Telegraf): void {
  registerInvitationHandlers(bot);
  registerInvitationActions();
  registerInvitationCommands(bot);
}
