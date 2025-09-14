const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');
const { getOrCreateGroupInvitationLink, requestLinkNotification, getUserCurrentGroup } = require('../../archive/archiveService');

module.exports = Composer.action('joinArchive', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}

  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(
        '❌ <b>Лицо не найдено в хрониках</b>\n\n' +
        'Твои следы растворились в тумане. Попробуй позже.',
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]]) }
      );
      return;
    }

    // Check current subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    if (subscriptionStatus.status === 'unpaid') {
      await ctx.editMessageText(
        `❌ <b>Нет активного взноса</b>\n\n` +
        `Сначала внеси взнос за <b>${subscriptionStatus.period}</b>. Используй кнопки в главном меню.`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]]) }
      );
      return;
    }

    // Get user's current group (канал месяца)
    const userGroup = await getUserCurrentGroup(userData.id);
    if (!userGroup) {
      await ctx.editMessageText(
        '❌ <b>Что-то пошло не так</b>\n\nПопробуй ещё раз позже.',
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]]) }
      );
      return;
    }

    // Try to get or create invitation link
    const linkResult = await getOrCreateGroupInvitationLink(userGroup.groupPeriod, userGroup.groupType);
    if (!linkResult.success) {
      await ctx.editMessageText(
        '❌ <b>Не удалось открыть дверь</b>\n\nПопробуй ещё раз позже.',
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]]) }
      );
      return;
    }

    // Compose message (это канал месяца, не «архив контента»)
    const groupTypeText = userGroup.groupType === 'plus' ? 'Расширенный сундук' : 'Обычный сундук';
    const openMessage =
    `📚 <b>Архив месяца</b>\n\n` +
    `✅ Доступ открыт.\n\n` +
    `📅 <b>Период:</b> ${userGroup.groupPeriod}\n` +
    `🔹 <b>Тип:</b> ${groupTypeText}\n\n` +
    `🎯 <b>Внутри:</b>\n` +
    `• STL-файлы месяца\n` +
    `• Обновления и дополнения\n` +
    `📚 <b>Архив готов для тебя</b>`;
  

    const keyboard = [
      [Markup.button.url('📚 Войти в архив', linkResult.link)],
      [Markup.button.callback('🚨 Дверь не открылась', 'linkNotWorking')],
      [Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]
    ];

    await ctx.editMessageText(openMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error in joinArchive:', error);
    await ctx.editMessageText(
      '❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.',
      { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]]) }
    );
  }
});
