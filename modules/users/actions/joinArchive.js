const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');
const { getOrCreateGroupInvitationLink, requestLinkNotification, getUserCurrentGroup } = require('../../archive/archiveService');
const { t } = require('../../i18n');

module.exports = Composer.action('joinArchive', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
      return;
    }

    // Check current subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    
    if (subscriptionStatus.status === 'unpaid') {
      await ctx.editMessageText(t('archive.noSubscription', { period: subscriptionStatus.period }), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
      return;
    }

    // Get user's current group
    const userGroup = await getUserCurrentGroup(userData.id);
    if (!userGroup) {
      await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
      return;
    }

    // Try to get or create invitation link
    const linkResult = await getOrCreateGroupInvitationLink(userGroup.groupPeriod, userGroup.groupType);
    
    if (!linkResult.success) {
      await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
      return;
    }

    // Show archive access message with invitation link
    const groupTypeText = userGroup.groupType === 'plus' ? '➕ Расширенная' : 'Обычная';
    const archiveMessage = t('archive.access', { period: userGroup.groupPeriod, typeText: groupTypeText });

    const archiveKeyboard = [
      [Markup.button.url(t('archive.join'), linkResult.link)],
      [Markup.button.callback(t('archive.linkIssue'), 'linkNotWorking')],
      [Markup.button.callback(t('messages.back'), 'refreshUserStatus')]
    ];

    await ctx.editMessageText(archiveMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(archiveKeyboard)
    });
    
  } catch (error) {
    console.error('Error in joinArchive:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
  }
});
