const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserCurrentGroup, requestLinkNotification } = require('../../archive/archiveService');
const SETTINGS = require('../../../settings.json');
const { t } = require('../../i18n');

module.exports = Composer.action('linkNotWorking', async (ctx) => {
  try { await ctx.answerCbQuery(t('messages.link_issue.sent')); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
      return;
    }

    // Get user's current group
    const userGroup = await getUserCurrentGroup(userData.id);
    if (!userGroup) {
      await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
      return;
    }

    // Record notification request
    await requestLinkNotification(userData.id, userGroup.groupPeriod, userGroup.groupType);

    // Send notification to EPINETOV
    const userName = userData.username ? `@${userData.username}` : 
                    (userData.first_name ? `${userData.first_name} ${userData.last_name || ''}`.trim() : `User ${userData.id}`);
    
    const adminMessage = `🔗 <b>Ссылка не работает!</b>\n\n` +
      `👤 <b>Пользователь:</b> ${userName} (ID: ${userData.id})\n` +
      `📅 <b>Период:</b> ${userGroup.groupPeriod}\n` +
      `🔹 <b>Тип:</b> ${userGroup.groupType}\n\n` +
      `⚠️ <b>Ссылка устарела или отозвана</b>\n\n` +
      `💡 <b>Действие:</b> Создайте новую ссылку для этой группы`;

    const adminKeyboard = [
      [Markup.button.callback(`🔗 Создать новую ссылку для ${userGroup.groupPeriod}_${userGroup.groupType}`, `createNewLink_${userGroup.groupPeriod}_${userGroup.groupType}`)],
      [Markup.button.callback(t('archiveUI.viewRequests'), 'viewLinkRequests')]
    ];

    try {
      await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, adminMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(adminKeyboard)
      });
      console.log(`📧 Link issue reported by user ${userData.id} for ${userGroup.groupPeriod}_${userGroup.groupType}`);
    } catch (error) {
      console.error('Failed to send admin notification:', error);
    }

    // Show confirmation to user
    const confirmationMessage = t('messages.oldMonths.linkWillNotify', { period: userGroup.groupPeriod, type: userGroup.groupType });

    await ctx.editMessageText(confirmationMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('messages.back'), 'refreshUserStatus')]
      ])
    });
    
  } catch (error) {
    console.error('Error in linkNotWorking:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
  }
});
