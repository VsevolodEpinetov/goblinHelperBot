const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { createSubscriptionInvoice } = require('../../payments/subscriptionPaymentService');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('payRegularMonth', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.months.back'), 'payCurrentMonth')]])
      });
      return;
    }

    // Create invoice for regular subscription
    const invoiceResult = await createSubscriptionInvoice(ctx, 'regular', userData.id);
    
    if (!invoiceResult.success) {
      await ctx.editMessageText(t('messages.invoice_failed'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.months.back'), 'payCurrentMonth')]])
      });
      return;
    }

    // Show simple confirmation message
    const successMessage = `${t('messages.invoice_created')}`;

    await ctx.editMessageText(successMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('messages.months.back'), 'payCurrentMonth')]
      ])
    });
    
  } catch (error) {
    console.error('Error in payRegularMonth:', error);
    await ctx.editMessageText(t('messages.try_again_later'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.months.back'), 'payCurrentMonth')]])
    });
  }
});
