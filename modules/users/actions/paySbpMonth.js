const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');

module.exports = Composer.action('paySbpMonth', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}

  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(
        '❌ <b>Лицо не найдено в хрониках</b>\n\n' +
        'Твои следы растворились в тумане логова. Попробуй позже или позови старейшину.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]])
        }
      );
      return;
    }

    // Check current subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    const currentPeriod = getCurrentMonthPeriod();

    if (subscriptionStatus.status !== 'unpaid') {
      // User already has a subscription
      await ctx.editMessageText(
        `✅ <b>Архив уже оплачен</b>\n\n` +
        `Ты внёс взнос за <b>${currentPeriod}</b>. Казна довольна, ворчать повода нет.\n\n` +
        `Если это ошибка — жми «Обновить» в главном меню.`,      
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]])
        }
      );
      return;
    }

    // Set up purchasing session for SBP payment
    ctx.userSession.purchasing = {
      type: 'group',
      year: ctx.globalSession.current.year,
      month: ctx.globalSession.current.month,
      userId: ctx.from.id,
      isOld: false
    };

    // Enter SBP payment scene
    ctx.scene.enter('SBP_PAYMENT');

  } catch (error) {
    console.error('Error in paySbpMonth:', error);
    await ctx.editMessageText(
      '❌ <b>Платёжный дух споткнулся</b>\n\nПопробуй ещё раз позже или позови старейшину.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]])
      }
    );
  }
});
