const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { ensureRoles } = require('../../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action(/^finishAdminPayment_/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  const paymentId = ctx.callbackQuery.data.split('_')[1];

  // Remove messages from EPINETOV
  if (ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV] && ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV][paymentId]) {
    ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV][paymentId].forEach(async messageId => {
      try {
        await ctx.telegram.deleteMessage(SETTINGS.CHATS.EPINETOV, messageId);
      } catch (error) {
        console.log(`Failed to delete message ${messageId} from EPINETOV:`, error.message);
      }
    })
    ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV][paymentId] = null;
  }

  // Remove messages from GLAVGOBLIN
  if (ctx.globalSession.toRemove[SETTINGS.CHATS.GLAVGOBLIN] && ctx.globalSession.toRemove[SETTINGS.CHATS.GLAVGOBLIN][paymentId]) {
    ctx.globalSession.toRemove[SETTINGS.CHATS.GLAVGOBLIN][paymentId].forEach(async messageId => {
      try {
        await ctx.telegram.deleteMessage(SETTINGS.CHATS.GLAVGOBLIN, messageId);
      } catch (error) {
        console.log(`Failed to delete message ${messageId} from GLAVGOBLIN:`, error.message);
      }
    })
    ctx.globalSession.toRemove[SETTINGS.CHATS.GLAVGOBLIN][paymentId] = null;
  }
});