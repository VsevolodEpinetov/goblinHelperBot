const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const { getKickstarter } = require('../../../db/helpers');
const { sendKickstarterPromo } = require('../util/kickstarterPromo');

module.exports = Composer.action(/^adminResendKickstarterPromo_(\d+)$/, async (ctx) => {
  // Check for super user
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут отправлять промо');
    return;
  }

  // Check for DM context
  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Отправка промо доступна только в личных сообщениях');
    return;
  }

  try {
    const kickstarterId = parseInt(ctx.match[1]);
    const kickstarterData = await getKickstarter(kickstarterId);

    if (!kickstarterData) {
      await ctx.answerCbQuery('❌ Кикстартер не найден');
      return;
    }

    await ctx.answerCbQuery('Отправляю промо...');

    // Send promo message
    const promoResult = await sendKickstarterPromo(ctx, kickstarterData, kickstarterId);

    if (promoResult.success) {
      await ctx.reply(`✅ Промо-сообщение отправлено в группу\n\nID кикстартера: ${kickstarterId}`, {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminKickstarters')]
        ])
      });
    } else {
      await ctx.reply(`❌ Ошибка отправки промо: ${promoResult.error}`, {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminKickstarters')]
        ])
      });
    }
  } catch (error) {
    console.error('Error in resendKickstarterPromo:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

