const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');
const knex = require('../../db/knex');
const { getUser } = require('../../db/helpers');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action('confirmParticipation', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.callbackQuery.from.id;
  
  try {
    // Update user status from prereg to pending
    await knex('userRoles')
      .where('userId', userId)
      .where('role', 'prereg')
      .del();
    
    await knex('userRoles').insert({
      userId: userId,
      role: 'pending'
    });
    
    console.log(`✅ User ${userId} confirmed participation, status changed to pending`);
    
    // Send notification to logs group
    try {
      const user = ctx.callbackQuery.from;
      const notificationMessage = 
        `${t('applyFlow.confirm.logTitle')}\n\n` +
        `👤 <b>Пользователь:</b> ${user.first_name} ${user.last_name || ''}\n` +
        `🆔 <b>ID:</b> <code>${userId}</code>\n` +
        `📱 <b>Username:</b> ${user.username ? `@${user.username}` : 'Не указан'}\n` +
        `📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}\n\n` +
        t('applyFlow.confirm.statusPending');
      
      await ctx.telegram.sendMessage(process.env.REQUESTS_GROUP_ID, notificationMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(t('applyFlow.confirm.approve'), `admin_approve_user_${userId}`),
            Markup.button.callback(t('applyFlow.confirm.reject'), `admin_reject_user_${userId}`)
          ],
          [
            Markup.button.callback(t('applyFlow.confirm.superApprove'), `admin_super_approve_user_${userId}`)
          ]
        ])
      });
    } catch (error) {
      console.error('Failed to send notification to requests group:', error);
    }
    
    // Show success message without buttons
    await ctx.editMessageText(
      t('applyFlow.confirm.success'),
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Error in confirmParticipation:', error);
    await ctx.editMessageText(
      t('applyFlow.confirm.error'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(t('applyFlow.confirm.startOver'), 'whatIsIt')]
        ])
      }
    );
  }
});
