const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { requestLinkNotification } = require('../../archive/archiveService');
const { getOrCreateGroupInvitationLink } = require('../../archive/archiveService');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^linkNotWorking_(\d{4}_\d{2})_(regular|plus)$/, async (ctx) => {
  try { await ctx.answerCbQuery('🔄 Обновляю ссылку...'); } catch {}
  
  try {
    const [, groupPeriod, groupType] = ctx.match;
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText('❌ <b>Лицо не найдено в хрониках</b>\n\nТвои данные исчезли в тумане. Попробуй снова позже.', { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]]) });
      return;
    }

    // User reported that link doesn't work - trust them and create a new link immediately
    console.log(`🔄 User ${userData.id} reported expired link for ${groupPeriod}_${groupType}, creating new link immediately`);
    
    // Force create a new link by bypassing existing link checks
    const newLinkResult = await getOrCreateGroupInvitationLink(groupPeriod, groupType);
    
    let confirmationMessage;
    
    if (newLinkResult.success) {
      // Successfully created new link
      const userName = userData.username ? `@${userData.username}` : 
                      (userData.first_name ? `${userData.first_name} ${userData.last_name || ''}`.trim() : `User ${userData.id}`);
      
      // Send notification to admins about the automatic fix
      const adminMessage = `🔄 <b>Автоматическое обновление ссылки</b>\n\n` +
        `👤 <b>Пользователь:</b> ${userName} (ID: ${userData.id})\n` +
        `📅 <b>Период:</b> ${groupPeriod}\n` +
        `🔹 <b>Тип:</b> ${groupType}\n\n` +
        `✅ <b>Ссылка автоматически обновлена</b>\n\n` +
        `🔗 <b>Новая ссылка:</b> ${newLinkResult.link}`;

      try {
        await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, adminMessage, { parse_mode: 'HTML' });
        await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, adminMessage, { parse_mode: 'HTML' });
        console.log(`✅ Auto-created new link for ${groupPeriod}_${groupType} after user report`);
      } catch (error) {
        console.error('Failed to send admin notification:', error);
      }

      // Show success message to user with new link
      confirmationMessage = `✅ <b>Ссылка обновлена!</b>\n\n` +
        `🔗 <b>Новая ссылка для ${groupPeriod} (${groupType}):</b>\n` +
        `${newLinkResult.link}\n\n` +
        `🎯 Ссылка действительна 90 дней`;
    } else {
      // Failed to create new link
      console.error(`❌ Failed to create new link for ${groupPeriod}_${groupType}:`, newLinkResult.error);
      
      // Fall back to admin notification
      await requestLinkNotification(userData.id, groupPeriod, groupType);
      
      const userName = userData.username ? `@${userData.username}` : 
                      (userData.first_name ? `${userData.first_name} ${userData.last_name || ''}`.trim() : `User ${userData.id}`);
      
      const adminMessage = `🔗 <b>Не удалось создать ссылку автоматически!</b>\n\n` +
        `👤 <b>Пользователь:</b> ${userName} (ID: ${userData.id})\n` +
        `📅 <b>Период:</b> ${groupPeriod}\n` +
        `🔹 <b>Тип:</b> ${groupType}\n\n` +
        `❌ <b>Ошибка:</b> ${newLinkResult.error}\n\n` +
        `💡 <b>Действие:</b> Создайте ссылку вручную`;

      try {
        await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, adminMessage, { parse_mode: 'HTML' });
        await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, adminMessage, { parse_mode: 'HTML' });
      } catch (error) {
        console.error('Failed to send admin notification:', error);
      }

      confirmationMessage = `❌ <b>Не удалось создать новую ссылку</b>\n\n` +
        `Обратился к администраторам. Они создадут ссылку вручную и уведомят тебя.`;
    }

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
