const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus } = require('../subscriptionHelpers');
const { getOrCreateGroupInvitationLink, getUserCurrentGroup } = require('../../archive/archiveService');

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

    // Generate links based on subscription type
    let links = [];
    let messageText = '';
    let keyboard = [];

    if (subscriptionStatus.hasPlus) {
      // User has plus subscription - generate both regular and plus links
      const regularLinkResult = await getOrCreateGroupInvitationLink(userGroup.groupPeriod, 'regular');
      const plusLinkResult = await getOrCreateGroupInvitationLink(userGroup.groupPeriod, 'plus');

      // Check if both links were successful
      if (!regularLinkResult.success || !plusLinkResult.success) {
        await ctx.editMessageText(
          '❌ <b>Не удалось открыть дверь</b>\n\nПопробуй ещё раз позже.',
          { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]]) }
        );
        return;
      }

      // Compose message for plus user with both archives
      messageText =
        `📚 <b>Архив месяца</b>\n\n` +
        `✅ Доступ открыт (расширенная версия).\n\n` +
        `📅 <b>Период:</b> ${userGroup.groupPeriod}\n\n` +
        `🎯 <b>Доступные архивы:</b>\n` +
        `• 📦 Обычный сундук\n` +
        `• ➕ Расширенный сундук\n\n` +
        `📚 <b>Архивы готовы для тебя</b>`;

      keyboard = [
        [Markup.button.url('📦 Обычный архив', regularLinkResult.link)],
        [Markup.button.url('➕ Расширенный архив', plusLinkResult.link)],
        [Markup.button.callback('-', 'dummy')],
        [Markup.button.callback('🚨 Обычный не работает', `linkNotWorking_${userGroup.groupPeriod}_regular`)],
        [Markup.button.callback('🚨 Плюс не работает', `linkNotWorking_${userGroup.groupPeriod}_plus`)],
        [Markup.button.callback('-', 'dummy')],
        [Markup.button.callback('⬅️ Назад', 'refreshUserStatus')],
      ];
    } else {
      // User has only regular subscription
      const linkResult = await getOrCreateGroupInvitationLink(userGroup.groupPeriod, userGroup.groupType);
      if (!linkResult.success) {
        await ctx.editMessageText(
          '❌ <b>Не удалось открыть дверь</b>\n\nПопробуй ещё раз позже.',
          { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]]) }
        );
        return;
      }

      // Compose message for regular user
      const groupTypeText = userGroup.groupType === 'plus' ? 'Расширенный архив' : 'Обычный архив';
      messageText =
        `📚 <b>Архив месяца</b>\n\n` +
        `✅ Доступ открыт.\n\n` +
        `📅 <b>Период:</b> ${userGroup.groupPeriod}\n` +
        `🔹 <b>Тип:</b> ${groupTypeText}\n\n` +
        `🎯 <b>Внутри:</b>\n` +
        `• STL-файлы месяца\n` +
        `• Обновления и дополнения\n` +
        `📚 <b>Архив готов для тебя</b>`;

      keyboard = [
        [Markup.button.url('📚 Войти в архив', linkResult.link)],
        [Markup.button.callback('-', 'dummy')],
        [Markup.button.callback('🚨 Дверь не открылась', `linkNotWorking_${userGroup.groupPeriod}_${userGroup.groupType}`)],
        [Markup.button.callback('-', 'dummy')],
        [Markup.button.callback('⬅️ Назад', 'refreshUserStatus')],
      ];
    }

    await ctx.editMessageText(messageText, {
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
