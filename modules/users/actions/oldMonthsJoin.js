const { Composer } = require('telegraf');
const { hasUserPurchasedMonth, getMonthChatId } = require('../../db/helpers');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^oldMonths_join_(\d{4}_\d{2})_(regular|plus)$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const userId = ctx.from.id;
  const [, period, type] = ctx.match;
  const [year, month] = period.split('_');

  const owns = await hasUserPurchasedMonth(userId, year, month, type);
  if (!owns) {
    await ctx.answerCbQuery('🕯 Главгоблин ворчит: хочешь знаний — плати звёздами.');
    return;
  }
  const chatId = await getMonthChatId(year, month, type);
  if (!chatId) {
    await ctx.answerCbQuery('🕳 Архив не найден. Позови администратора — он знает тропы.');
    return;
  }
  try {
    const { getOrCreateGroupInvitationLink, requestLinkNotification } = require('../../archive/archiveService');
    const groupPeriod = `${year}_${month}`;
    const linkResult = await getOrCreateGroupInvitationLink(groupPeriod, type);
    if (linkResult?.success && linkResult.link) {
      await ctx.replyWithHTML(
        `📚 <b>Архив</b>\n\n` +
        `✅ <b>Доступ открыт</b>\n\n` +
        `📅 <b>Период:</b> ${groupPeriod}\n` +
        `🔹 <b>Тип:</b> ${type === 'plus' ? 'Расширенный' : 'Обычный'}\n\n` +
        `🎯 <b>Внутри:</b>\n` +
        `• Все материалы месяца\n` +
        `• Обновления и дополнения\n\n` +
        `🕯 <b>Печать доступа выдана</b>\n\n` +
        `Твоя ссылка: ${linkResult.link}`
      );
    } else {
      try { await requestLinkNotification(Number(userId), groupPeriod, type); } catch {}
      await ctx.replyWithHTML(
        `✅ <b>Оплата получена!</b>\n\n` +
        `Доступ будет предоставлен автоматически. Для <b>${groupPeriod}</b> (${type}) пока нет активной ссылки.\n` +
        `Мы уведомим тебя, как только старейшины её создадут.`
      );
      try {
        await ctx.telegram.sendMessage(
          SETTINGS.CHATS.EPINETOV,
          `⚠️ Нет ссылки для ${groupPeriod} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
        );
        await ctx.telegram.sendMessage(
          SETTINGS.CHATS.GLAVGOBLIN,
          `⚠️ Нет ссылки для ${groupPeriod} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
        );
      } catch {}
    }
  } catch (e) {
    await ctx.replyWithHTML(
      `✅ <b>Оплата получена!</b>\n\n` +
      `Доступ будет предоставлен автоматически. Для <b>${year}_${month}</b> (${type}) пока нет активной ссылки.\n` +
      `Мы уведомим тебя, как только старейшины её создадут.`
    );
    try {
      await ctx.telegram.sendMessage(
        SETTINGS.CHATS.EPINETOV,
        `⚠️ Нет ссылки для ${year}_${month} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
      );
      await ctx.telegram.sendMessage(
        SETTINGS.CHATS.GLAVGOBLIN,
        `⚠️ Нет ссылки для ${year}_${month} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
      );
    } catch {}
  }
});
