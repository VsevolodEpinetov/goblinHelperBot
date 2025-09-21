const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { requestLinkNotification } = require('../../archive/archiveService');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^linkNotWorking_(\d{4}_\d{2})_(regular|plus)$/, async (ctx) => {
  try { await ctx.answerCbQuery('📧 Запрос отправлен администратору'); } catch {}
  
  try {
    const [, groupPeriod, groupType] = ctx.match;
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText('❌ <b>Лицо не найдено в хрониках</b>\n\nТвои данные исчезли в тумане. Попробуй снова позже.', { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]]) });
      return;
    }

    // Record notification request
    await requestLinkNotification(userData.id, groupPeriod, groupType);

    // Send notification to EPINETOV and GLAVGOBLIN
    const userName = userData.username ? `@${userData.username}` : 
                    (userData.first_name ? `${userData.first_name} ${userData.last_name || ''}`.trim() : `User ${userData.id}`);
    
    const adminMessage = `🔗 <b>Ссылка не работает!</b>\n\n` +
      `👤 <b>Пользователь:</b> ${userName} (ID: ${userData.id})\n` +
      `📅 <b>Период:</b> ${groupPeriod}\n` +
      `🔹 <b>Тип:</b> ${groupType}\n\n` +
      `⚠️ <b>Ссылка устарела или отозвана</b>\n\n` +
      `💡 <b>Действие:</b> Создайте новую ссылку для этой группы`;

    const adminKeyboard = [
      [Markup.button.callback(`🔗 Создать новую ссылку для ${groupPeriod}_${groupType}`, `createNewLink_${groupPeriod}_${groupType}`)],
      [Markup.button.callback('📋 Просмотреть все запросы', 'viewLinkRequests')]
    ];

    try {
      // Send to EPINETOV
      await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, adminMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(adminKeyboard)
      });
      
      // Send to GLAVGOBLIN
      await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, adminMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(adminKeyboard)
      });
      
      console.log(`📧 Link issue reported by user ${userData.id} for ${groupPeriod}_${groupType}`);
    } catch (error) {
      console.error('Failed to send admin notification:', error);
    }

    // Show confirmation to user
    const confirmationMessage = `✅ <b>Взнос получен!</b>\n\nДля ${groupPeriod} (${groupType}) пока нет живой ссылки. Мы известим тебя, когда админ откроет врата. Если через два дня — напомним ему пинком.`;

    await ctx.editMessageText(confirmationMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'refreshUserStatus')]
      ])
    });
    
  } catch (error) {
    console.error('Error in linkNotWorking:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]]) });
  }
});
