import type { Telegraf } from 'telegraf';

import { registerPaymentAdminActions } from './admin-actions';
import { registerPaymentHandlers } from './handlers';

export { sendStarsInvoice } from './invoice';
export { encodePayload, decodePayload } from './service';
export type { PaymentPayloadT } from './schemas';
export { sbpScene, SBP_SCENE_ID, type SbpDraft } from './sbp-scene';
export {
  processSubscriptionPayment,
  processUpgradePayment,
  processKickstarterPayment,
  processSuccessfulPayment,
} from './service';

export function register(bot: Telegraf): void {
  registerPaymentHandlers(bot);
  registerPaymentAdminActions(bot);
}
