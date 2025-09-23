const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');
const { hasAchievement } = require('../../loyalty/achievementsService');
const util = require('../../util');

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

    // SECURITY CHECK: Verify user has SBP payment achievement
    const SBP_PAYMENT = 'sbp_payment';
    const hasSbpPayment = await hasAchievement(Number(userData.id), SBP_PAYMENT);
    
    if (!hasSbpPayment) {
      await ctx.editMessageText(
        '🔒 <b>Доступ запрещён</b>\n\n' +
        'Эта функция доступна только пользователям с особыми правами.\n' +
        'Обратитесь к администратору для получения доступа.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]])
        }
      );
      return;
    }

    // Check current subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    const currentPeriod = util.getCurrentPeriod(ctx);

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
      year: currentPeriod.year,
      month: currentPeriod.month,
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
