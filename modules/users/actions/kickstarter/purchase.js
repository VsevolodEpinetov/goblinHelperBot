const { Composer, Markup } = require("telegraf");
const { getKickstarter, getUser, hasUserPurchasedKickstarter } = require('../../../db/helpers');
const { getUsableScrolls } = require('../../../util/scrolls');
const { createKickstarterInvoice } = require('../../../payments/kickstarterPaymentService');

module.exports = Composer.action(/^purchaseKickstarter_(\d+)$/, async (ctx) => {
  try {
    const kickstarterId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;

    // Get kickstarter data
    const kickstarterData = await getKickstarter(kickstarterId);
    if (!kickstarterData) {
      await ctx.answerCbQuery('❌ Кикстартер не найден');
      return;
    }

    // Check if user already has this kickstarter
    const alreadyHas = await hasUserPurchasedKickstarter(userId, kickstarterId);
    if (alreadyHas) {
      await ctx.answerCbQuery('✅ У тебя уже есть доступ к этому кикстартеру');
      return;
    }

    // Get user data
    const userData = await getUser(userId);
    if (!userData) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    // Check for usable scrolls
    const usableScrolls = await getUsableScrolls(userId, kickstarterData.cost);

    if (usableScrolls.length > 0) {
      // User has scrolls - offer choice
      let message = `🛒 <b>Покупка кикстартера</b>\n\n`;
      message += `<b>${kickstarterData.name}</b>\n`;
      message += `Автор: <b>${kickstarterData.creator}</b>\n`;
      message += `Цена: <b>${kickstarterData.cost}⭐</b>\n\n`;
      message += `📜 У тебя есть свитки, которые можно использовать:\n\n`;

      usableScrolls.forEach((scroll, index) => {
        message += `${index + 1}. <b>${scroll.scrollDef.name}</b> (${scroll.amount} шт.)\n`;
      });

      message += `\nВыбери способ оплаты:`;

      const keyboard = [];
      
      // Add scroll buttons
      usableScrolls.forEach((scroll, index) => {
        keyboard.push([
          Markup.button.callback(
            `📜 Использовать ${scroll.scrollDef.name} (${scroll.amount} шт.)`,
            `purchaseKickstarterWithScroll_${kickstarterId}_${scroll.scrollId}`
          )
        ]);
      });

      // Add stars payment button
      keyboard.push([
        Markup.button.callback(`⭐ Оплатить ${kickstarterData.cost}⭐`, `purchaseKickstarterWithStars_${kickstarterId}`)
      ]);

      keyboard.push([
        Markup.button.callback('❌ Отмена', 'userKickstarters')
      ]);

      await ctx.answerCbQuery();
      await ctx.replyWithHTML(message, {
        ...Markup.inlineKeyboard(keyboard)
      });
    } else {
      // No scrolls - send invoice directly
      await ctx.answerCbQuery('Открываю счёт...');
      const result = await createKickstarterInvoice(ctx, kickstarterId, userId);
      
      if (!result.success) {
        await ctx.reply(`❌ Ошибка создания счёта: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('Error in purchase kickstarter:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});
